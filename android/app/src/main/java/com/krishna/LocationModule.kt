package com.krishna

import android.content.Intent
import android.os.Build

import androidx.core.content.ContextCompat

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LocationModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    // React Native NativeModules name
    override fun getName(): String {
        return "LocationForegroundService"
    }

    // =========================================================
    // START LOCATION FOREGROUND SERVICE
    // =========================================================

    @ReactMethod
    fun startService(
        driverId: Int,
        promise: Promise
    ) {

        try {

            if (driverId <= 0) {

                promise.reject(
                    "INVALID_DRIVER_ID",
                    "Invalid driver ID"
                )

                return
            }

            val intent = Intent(
                reactContext,
                LocationForegroundService::class.java
            )

            intent.putExtra(
                "driver_id",
                driverId
            )

            if (
                Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.O
            ) {

                ContextCompat.startForegroundService(
                    reactContext,
                    intent
                )

            } else {

                reactContext.startService(
                    intent
                )
            }

            promise.resolve(true)

        } catch (e: Exception) {

            promise.reject(
                "START_SERVICE_ERROR",
                e.message,
                e
            )
        }
    }

    // =========================================================
    // STOP LOCATION FOREGROUND SERVICE
    // =========================================================

    @ReactMethod
    fun stopService(
        promise: Promise
    ) {

        try {

            val intent = Intent(
                reactContext,
                LocationForegroundService::class.java
            )

            val stopped =
                reactContext.stopService(intent)

            if (stopped) {

                promise.resolve(true)

            } else {

                promise.resolve(false)
            }

        } catch (e: Exception) {

            promise.reject(
                "STOP_SERVICE_ERROR",
                e.message,
                e
            )
        }
    }
}