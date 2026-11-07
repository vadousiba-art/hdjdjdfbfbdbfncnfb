package com.israeltoknt.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.CookieManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import okio.source
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiError(val code: String, override val message: String, val status: Int) : Exception(message)

// The app is a client of the same YORU server as the website: it signs in
// with the same session cookies and calls the same /api/rpc functions, so
// every rule (and Night Watch) applies exactly as on the web.
object Api {
    lateinit var base: String
        private set
    lateinit var http: OkHttpClient
        private set
    private lateinit var jar: SessionCookies
    private val JSON = "application/json; charset=utf-8".toMediaType()

    fun init(ctx: Context, baseUrl: String) {
        base = baseUrl.trimEnd('/')
        jar = SessionCookies(ctx.applicationContext)
        http = OkHttpClient.Builder()
            .cookieJar(jar)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                chain.proceed(chain.request().newBuilder().header("User-Agent", "YORU-Android/2 (${android.os.Build.MODEL})").build())
            }
            .build()
    }

    /** Absolute URL for a post's media path (same rules as the web's mediaSrc). */
    fun media(url: String?): String? = when {
        url.isNullOrEmpty() -> null
        url.startsWith("http") -> url
        url.startsWith("/") -> base + url
        else -> "$base/api/media/$url"
    }

    fun webUrl(path: String) = if (path.startsWith("http")) path else base + path

    private suspend fun call(req: Request): Any? = withContext(Dispatchers.IO) {
        val res = try {
            http.newCall(req).execute()
        } catch (e: IOException) {
            throw ApiError("OFFLINE", "Can't reach YORU. Check your connection.", 0)
        }
        res.use { r ->
            val text = r.body?.string().orEmpty()
            val obj = runCatching { JSONObject(text) }.getOrNull()
            if (!r.isSuccessful) {
                val err = obj?.optJSONObject("error")
                throw ApiError(err?.optString("code") ?: "HTTP_${r.code}", err?.optString("message")?.ifEmpty { null } ?: "Something went wrong (${r.code}).", r.code)
            }
            if (obj == null) return@use runCatching { JSONArray(text) }.getOrNull()
            if (obj.has("data")) obj.opt("data") else obj
        }
    }

    suspend fun post(path: String, body: JSONObject = JSONObject()): Any? =
        call(Request.Builder().url(base + path).post(body.toString().toRequestBody(JSON)).build())

    suspend fun get(path: String): Any? = call(Request.Builder().url(base + path).get().build())

    suspend fun rpc(fn: String, vararg args: Pair<String, Any?>): Any? {
        val body = JSONObject()
        for ((k, v) in args) if (v != null) body.put(k, v)
        return post("/api/rpc/$fn", body)
    }

    suspend fun rpcObj(fn: String, vararg args: Pair<String, Any?>): JSONObject = rpc(fn, *args) as? JSONObject ?: JSONObject()
    suspend fun rpcArr(fn: String, vararg args: Pair<String, Any?>): JSONArray = rpc(fn, *args) as? JSONArray ?: JSONArray()

    // ---------------------------------------------------------------- session

    suspend fun me(): Me = Me.parse(rpcObj("get_me"))

    suspend fun login(email: String, password: String) {
        post("/api/auth/login", JSONObject().put("email", email).put("password", password))
    }

    /** Demo servers only: the account picker. Null on real servers. */
    suspend fun demoUsers(): List<Profile>? = runCatching { (get("/api/auth/demo-users") as? JSONArray)?.map { Profile.parse(it) } }.getOrNull()

    suspend fun demoLogin(userId: String) {
        post("/api/auth/login", JSONObject().put("user_id", userId))
    }

    suspend fun logout() {
        runCatching { post("/api/auth/logout") }
        jar.clear()
        withContext(Dispatchers.Main) { CookieManager.getInstance().removeAllCookies(null) }
    }

    fun hasSession() = jar.hasAny()

    /** Copies the session into the WebView (for the few pages shown as web). */
    fun cookiesToWebView() {
        val cm = CookieManager.getInstance()
        cm.setAcceptCookie(true)
        for (c in jar.all()) cm.setCookie(base, "${c.name}=${c.value}; Path=${c.path}${if (c.secure) "; Secure" else ""}")
        cm.flush()
    }

    /** After a web page (for example joining), keep whatever session it set. */
    fun cookiesFromWebView() {
        val raw = CookieManager.getInstance().getCookie(base) ?: return
        val url = base.toHttpUrl()
        val cookies = raw.split(";").mapNotNull { part ->
            val kv = part.trim()
            if (!kv.contains("=")) null else Cookie.parse(url, "$kv; Path=/; Max-Age=2592000${if (url.isHttps) "; Secure" else ""}")
        }
        jar.saveFromResponse(url, cookies)
    }

    // ---------------------------------------------------------------- uploads

    data class Uploaded(val path: String, val kind: String)

    /** Uploads a picked or captured file the same way the website does. */
    suspend fun upload(ctx: Context, uri: Uri, mimeHint: String? = null): Uploaded = withContext(Dispatchers.IO) {
        val cr = ctx.contentResolver
        var mime = mimeHint ?: cr.getType(uri) ?: "image/jpeg"
        if (mime == "image/jpg") mime = "image/jpeg"
        var size = cr.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { if (it.moveToFirst()) it.getLong(0) else -1L } ?: -1L
        var bytes: ByteArray? = null
        // Large photos are resized like the website does before upload.
        if (mime.startsWith("image/") && mime != "image/gif" && (size < 0 || size > 1_500_000)) {
            val bmp = cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
            if (bmp != null) {
                val scale = minOf(1f, 2048f / maxOf(bmp.width, bmp.height))
                val scaled = if (scale < 1f) Bitmap.createScaledBitmap(bmp, (bmp.width * scale).toInt(), (bmp.height * scale).toInt(), true) else bmp
                val out = ByteArrayOutputStream()
                scaled.compress(Bitmap.CompressFormat.JPEG, 86, out)
                bytes = out.toByteArray()
                mime = "image/jpeg"
                size = bytes.size.toLong()
            }
        }
        if (size < 0) {
            bytes = cr.openInputStream(uri)?.use { it.readBytes() } ?: throw ApiError("INVALID", "Couldn't read that file.", 400)
            size = bytes.size.toLong()
        }
        val slot = post("/api/upload/sign", JSONObject().put("type", mime).put("size", size)) as JSONObject
        val body = if (bytes != null) bytes.toRequestBody(mime.toMediaType()) else object : RequestBody() {
            override fun contentType() = mime.toMediaType()
            override fun contentLength() = size
            override fun writeTo(sink: BufferedSink) {
                cr.openInputStream(uri)?.source()?.use { sink.writeAll(it) } ?: throw IOException("file vanished")
            }
        }
        val req = if (slot.optString("mode") == "supabase") {
            val key = slot.optString("apikey")
            Request.Builder().url(slot.getString("signedUrl")).put(body)
                .header("apikey", key).header("Authorization", "Bearer $key").header("x-upsert", "false")
                .header("cache-control", "max-age=3600").build()
        } else {
            Request.Builder().url(base + slot.getString("uploadUrl")).put(body).build()
        }
        http.newCall(req).execute().use { r ->
            if (!r.isSuccessful) throw ApiError("UPLOAD", "Upload failed (${r.code}).", r.code)
        }
        Uploaded(slot.getString("path"), slot.optString("kind", if (mime.startsWith("video/")) "video" else "image"))
    }
}

/** Session cookies, kept across launches in private app storage. */
private class SessionCookies(ctx: Context) : CookieJar {
    private val prefs = ctx.getSharedPreferences("yoru_session", Context.MODE_PRIVATE)
    private val cookies = mutableMapOf<String, Cookie>()

    init {
        prefs.all.forEach { (k, v) ->
            val parts = (v as? String)?.split("\u0000") ?: return@forEach
            if (parts.size == 2) runCatching { Cookie.parse(parts[0].toHttpUrl(), parts[1]) }.getOrNull()?.let { cookies[k] = it }
        }
    }

    private fun key(c: Cookie) = "${c.domain}|${c.path}|${c.name}"

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val edit = prefs.edit()
        for (c in cookies) {
            val k = key(c)
            if (c.expiresAt < System.currentTimeMillis()) {
                this.cookies.remove(k)
                edit.remove(k)
            } else {
                this.cookies[k] = c
                val origin = "${if (c.secure) "https" else "http"}://${c.domain}${c.path}"
                edit.putString(k, origin + "\u0000" + c.toString())
            }
        }
        edit.apply()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        // Like browsers, treat localhost as secure (local test servers set Secure cookies over http).
        val local = url.host == "localhost" || url.host == "127.0.0.1" || url.host == "10.0.2.2"
        val asHttps = if (local && !url.isHttps) url.newBuilder().scheme("https").build() else url
        return cookies.values.filter { it.expiresAt > now && (it.matches(url) || (local && it.matches(asHttps))) }
    }

    @Synchronized fun all(): List<Cookie> = cookies.values.toList()
    @Synchronized fun hasAny() = cookies.values.any { it.expiresAt > System.currentTimeMillis() }

    @Synchronized
    fun clear() {
        cookies.clear()
        prefs.edit().clear().apply()
    }
}
