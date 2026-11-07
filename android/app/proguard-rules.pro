# The page calls these through window.YoruApp.
-keepclassmembers class com.israeltoknt.app.AppBridge {
    @android.webkit.JavascriptInterface <methods>;
}
