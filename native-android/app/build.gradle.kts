plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.warroompicks.WarRoom"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.warroompicks.WarRoom"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "3.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
        buildConfigField("String", "FIREBASE_APPLICATION_ID", "\"${providers.gradleProperty("WARROOM_FIREBASE_APP_ID").orNull ?: ""}\"")
        buildConfigField("String", "FIREBASE_API_KEY", "\"${providers.gradleProperty("WARROOM_FIREBASE_API_KEY").orNull ?: ""}\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"${providers.gradleProperty("WARROOM_FIREBASE_PROJECT_ID").orNull ?: ""}\"")
        buildConfigField("String", "FIREBASE_SENDER_ID", "\"${providers.gradleProperty("WARROOM_FIREBASE_SENDER_ID").orNull ?: ""}\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    val keystorePath = providers.environmentVariable("WAR_ROOM_ANDROID_KEYSTORE").orNull
    val keystorePassword = providers.environmentVariable("WAR_ROOM_ANDROID_KEYSTORE_PASSWORD").orNull
    val keyAliasValue = providers.environmentVariable("WAR_ROOM_ANDROID_KEY_ALIAS").orNull
    val keyPasswordValue = providers.environmentVariable("WAR_ROOM_ANDROID_KEY_PASSWORD").orNull
    if (keystorePath != null && keystorePassword != null && keyAliasValue != null && keyPasswordValue != null) {
        signingConfigs.create("playRelease") {
            storeFile = file(keystorePath)
            storePassword = keystorePassword
            keyAlias = keyAliasValue
            keyPassword = keyPasswordValue
        }
        buildTypes.getByName("release").signingConfig = signingConfigs.getByName("playRelease")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    packaging.resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.08.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.fragment:fragment-ktx:1.8.9")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.2")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.2")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.9.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("io.coil-kt.coil3:coil-compose:3.3.0")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.3.0")
    implementation(platform("com.google.firebase:firebase-bom:34.2.0"))
    implementation("com.google.firebase:firebase-messaging")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
