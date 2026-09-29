# kotlinx.serialization keeps its own generated serializers; these cover our @Serializable models
-keepclassmembers @kotlinx.serialization.Serializable class com.radsoftinc.photoaura.** {
    *** Companion;
    *** INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class com.radsoftinc.photoaura.core.**$$serializer { *; }

# Ktor pulls optional classes it only touches reflectively
-dontwarn org.slf4j.**
-dontwarn io.ktor.**
-dontwarn java.lang.management.**
