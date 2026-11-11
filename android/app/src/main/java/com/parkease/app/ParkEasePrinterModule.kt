package com.parkease.app

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.IOException
import java.nio.charset.Charset
import java.util.UUID
import java.util.concurrent.Executors

class ParkEasePrinterModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val executor = Executors.newSingleThreadExecutor()
  private val sppUuid = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

  override fun getName() = "ParkEasePrinter"

  @ReactMethod
  fun pairedPrinters(promise: Promise) {
    try {
      val adapter = bluetoothAdapter() ?: return promise.reject("BLUETOOTH_UNAVAILABLE", "This device does not support Bluetooth.")
      if (!hasConnectPermission()) return promise.reject("BLUETOOTH_PERMISSION", "Allow nearby-device permission before discovering printers.")
      val result = Arguments.createArray()
      adapter.bondedDevices.sortedBy { it.name ?: it.address }.forEach { device ->
        val item = Arguments.createMap()
        item.putString("id", device.address)
        item.putString("name", device.name ?: "Bluetooth printer")
        result.pushMap(item)
      }
      promise.resolve(result)
    } catch (error: SecurityException) {
      promise.reject("BLUETOOTH_PERMISSION", "Allow nearby-device permission before discovering printers.", error)
    } catch (error: Exception) {
      promise.reject("BLUETOOTH_DISCOVERY_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun print(deviceAddress: String, text: String, qrPayload: String?, promise: Promise) {
    executor.execute {
      var socket: BluetoothSocket? = null
      try {
        val adapter = bluetoothAdapter() ?: throw IllegalStateException("Bluetooth is not available.")
        if (!hasConnectPermission()) throw SecurityException("Nearby-device permission is required.")
        adapter.cancelDiscovery()
        socket = adapter.getRemoteDevice(deviceAddress).createRfcommSocketToServiceRecord(sppUuid)
        socket.connect()
        val output = socket.outputStream
        output.write(byteArrayOf(0x1B, 0x40))
        output.write(text.toByteArray(Charset.forName("UTF-8")))
        if (!qrPayload.isNullOrBlank()) output.write(qrCommands(qrPayload))
        output.write(byteArrayOf(0x0A, 0x0A, 0x1D, 0x56, 0x00))
        output.flush()
        promise.resolve(true)
      } catch (error: SecurityException) {
        promise.reject("BLUETOOTH_PERMISSION", "Allow nearby-device permission before printing.", error)
      } catch (error: Exception) {
        promise.reject("BLUETOOTH_PRINT_FAILED", error.message ?: "Printer connection failed.", error)
      } finally {
        try { socket?.close() } catch (_: IOException) { }
      }
    }
  }

  private fun bluetoothAdapter(): BluetoothAdapter? {
    val manager = reactContext.getSystemService(android.content.Context.BLUETOOTH_SERVICE) as? android.bluetooth.BluetoothManager
    return manager?.adapter ?: BluetoothAdapter.getDefaultAdapter()
  }

  private fun hasConnectPermission(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || reactContext.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

  private fun qrCommands(value: String): ByteArray {
    val data = value.toByteArray(Charsets.UTF_8)
    val size = data.size + 3
    val store = byteArrayOf(0x1D, 0x28, 0x6B, (size and 0xFF).toByte(), ((size shr 8) and 0xFF).toByte(), 0x31, 0x50, 0x30) + data
    val print = byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)
    return byteArrayOf(0x1B, 0x61, 0x01) + store + print + byteArrayOf(0x0A)
  }
}
