# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ML Kit (photo text recognition) finds its parts through Firebase component
# discovery, which builds each ComponentRegistrar by reflection from the
# names in the manifest. R8 can't see that, and dropped their constructors
# in the release build ("NoSuchMethodException: …TextRegistrar.<init>").
-keep class * implements com.google.firebase.components.ComponentRegistrar {
    public <init>();
}
