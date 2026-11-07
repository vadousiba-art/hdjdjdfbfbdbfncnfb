package com.israeltoknt.app

import android.app.Application
import android.os.Build
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.gif.AnimatedImageDecoder
import coil3.gif.GifDecoder
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.work.NotifyWorker

class YoruApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Api.init(this, BuildConfig.APP_URL)
        NotifyWorker.createChannel(this)
        // Images load through the same signed-in client, so members-only media works.
        SingletonImageLoader.setSafe { ctx ->
            ImageLoader.Builder(ctx)
                .components {
                    add(OkHttpNetworkFetcherFactory(callFactory = { Api.http }))
                    if (Build.VERSION.SDK_INT >= 28) add(AnimatedImageDecoder.Factory()) else add(GifDecoder.Factory())
                }
                .crossfade(true)
                .build()
        }
    }
}
