package com.krishna

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat

import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

import kotlin.concurrent.thread

class LocationForegroundService : Service() {

    companion object {

        private const val TAG = "VEHICLE_TRACKER"

        private const val CHANNEL_ID = "vehicle_tracking"

        private const val NOTIFICATION_ID = 1001

        private const val LOCATION_INTERVAL = 5000L

        private const val FASTEST_INTERVAL = 3000L

        private const val API_URL =
            "https://blackpathsoftwaresolutions.com/api/driver/location"

        private const val PREFS_NAME = "vehicle_tracking_prefs"

        private const val PREF_DRIVER_ID = "driver_id"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient

    private lateinit var locationCallback: LocationCallback

    private var driverId: Int = 0


    // =========================================================
    // SERVICE CREATE
    // =========================================================

    override fun onCreate() {

        super.onCreate()

        Log.d(TAG, "LocationForegroundService created")

        createNotificationChannel()

        fusedLocationClient =
            LocationServices.getFusedLocationProviderClient(this)

        // -----------------------------------------------------
        // Android 10+ needs the foreground service type
        // (Android 14+ crashes without it)
        // -----------------------------------------------------

        try {

            val notification = createNotification()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {

                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                )

            } else {

                startForeground(NOTIFICATION_ID, notification)
            }

        } catch (e: Exception) {

            Log.e(TAG, "startForeground failed", e)

            stopSelf()
        }
    }


    // =========================================================
    // SERVICE START
    // =========================================================

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int
    ): Int {

        // -----------------------------------------------------
        // Get driver ID from React Native
        // -----------------------------------------------------

        val receivedDriverId = intent?.getIntExtra("driver_id", 0) ?: 0

        if (receivedDriverId > 0) {

            driverId = receivedDriverId

            // Save driver ID
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putInt(PREF_DRIVER_ID, driverId)
                .apply()

        } else {

            // Service restarted by Android - recover saved driver ID
            driverId = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getInt(PREF_DRIVER_ID, 0)
        }

        Log.d(TAG, "Driver ID: $driverId")

        // -----------------------------------------------------
        // Validate driver ID
        // -----------------------------------------------------

        if (driverId <= 0) {

            Log.e(TAG, "Invalid driver ID. Stopping service.")

            stopSelf()

            return START_NOT_STICKY
        }

        // -----------------------------------------------------
        // Remove old callback if already running
        // -----------------------------------------------------

        if (::locationCallback.isInitialized) {

            fusedLocationClient.removeLocationUpdates(locationCallback)
        }

        // -----------------------------------------------------
        // Start GPS
        // -----------------------------------------------------

        startLocationUpdates()

        // Keep service alive in background
        return START_STICKY
    }


    // =========================================================
    // NOTIFICATION CHANNEL
    // =========================================================

    private fun createNotificationChannel() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            val channel = NotificationChannel(
                CHANNEL_ID,
                "Vehicle Tracking",
                NotificationManager.IMPORTANCE_LOW
            )

            channel.description = "Vehicle live location tracking"

            val manager = getSystemService(NotificationManager::class.java)

            manager.createNotificationChannel(channel)
        }
    }


    // =========================================================
    // NOTIFICATION
    // =========================================================

    private fun createNotification(): Notification {

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Vehicle Tracking Active")
            .setContentText("Your live location is being shared")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }


    // =========================================================
    // GPS LOCATION
    // =========================================================

    private fun startLocationUpdates() {

        val fineGranted =
            ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

        val coarseGranted =
            ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

        if (!fineGranted && !coarseGranted) {

            Log.e(TAG, "Location permission not granted")

            stopSelf()

            return
        }

        // -----------------------------------------------------
        // Location request
        // -----------------------------------------------------

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_INTERVAL
        )
            .setMinUpdateIntervalMillis(FASTEST_INTERVAL)
            .setMinUpdateDistanceMeters(5f)
            .build()

        // -----------------------------------------------------
        // Location callback
        // -----------------------------------------------------

        locationCallback = object : LocationCallback() {

            override fun onLocationResult(locationResult: LocationResult) {

                for (location in locationResult.locations) {

                    val latitude = location.latitude
                    val longitude = location.longitude
                    val accuracy = location.accuracy
                    val speed = location.speed

                    Log.d(
                        TAG,
                        "GPS => " +
                            "driver=$driverId " +
                            "lat=$latitude " +
                            "lng=$longitude " +
                            "accuracy=$accuracy " +
                            "speed=$speed"
                    )

                    // Send location to Laravel
                    sendLocationToServer(
                        latitude,
                        longitude,
                        accuracy,
                        speed
                    )
                }
            }
        }

        // -----------------------------------------------------
        // Start location updates
        // -----------------------------------------------------

        try {

            fusedLocationClient
                .requestLocationUpdates(
                    locationRequest,
                    locationCallback,
                    mainLooper
                )
                .addOnSuccessListener {

                    Log.d(TAG, "GPS location updates started")
                }
                .addOnFailureListener { error ->

                    Log.e(TAG, "GPS start failed", error)
                }

        } catch (e: SecurityException) {

            Log.e(TAG, "Location permission denied", e)

            stopSelf()
        }
    }


    // =========================================================
    // SEND LOCATION TO LARAVEL
    // =========================================================

    private fun sendLocationToServer(
        latitude: Double,
        longitude: Double,
        accuracy: Float,
        speed: Float
    ) {

        // Driver ID validation
        if (driverId <= 0) {

            Log.e(TAG, "Invalid driver ID")

            return
        }

        // Background network thread
        thread {

            var connection: HttpURLConnection? = null

            try {

                val url = URL(API_URL)

                connection = url.openConnection() as HttpURLConnection

                // HTTP
                connection.requestMethod = "POST"
                connection.connectTimeout = 15000
                connection.readTimeout = 15000
                connection.doOutput = true

                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("Content-Type", "application/json")

                // JSON
                val json = """
                    {
                        "user_id": $driverId,
                        "latitude": $latitude,
                        "longitude": $longitude,
                        "accuracy": $accuracy,
                        "speed": $speed
                    }
                """.trimIndent()

                Log.d(TAG, "Sending location: $json")

                // Send request
                OutputStreamWriter(connection.outputStream).use { writer ->

                    writer.write(json)

                    writer.flush()
                }

                // Response
                val responseCode = connection.responseCode

                Log.d(TAG, "Laravel response code: $responseCode")

                if (responseCode in 200..299) {

                    Log.d(TAG, "Location uploaded successfully")

                } else {

                    Log.e(TAG, "Location upload failed: $responseCode")
                }

            } catch (e: Exception) {

                Log.e(TAG, "Location API error", e)

            } finally {

                connection?.disconnect()
            }
        }
    }


    // =========================================================
    // SERVICE DESTROY
    // =========================================================

    override fun onDestroy() {

        Log.d(TAG, "LocationForegroundService destroyed")

        // Stop GPS updates
        if (::locationCallback.isInitialized) {

            fusedLocationClient.removeLocationUpdates(locationCallback)
        }

        // Remove notification
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {

            stopForeground(STOP_FOREGROUND_REMOVE)

        } else {

            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        // Remove saved driver ID
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .remove(PREF_DRIVER_ID)
            .apply()

        super.onDestroy()
    }


    // =========================================================
    // SERVICE BIND
    // =========================================================

    override fun onBind(intent: Intent?): IBinder? {

        return null
    }
}