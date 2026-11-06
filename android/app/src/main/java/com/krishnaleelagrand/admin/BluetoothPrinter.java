package com.krishnaleelagrand.admin;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Classic-Bluetooth (SPP/RFCOMM) thermal printer, same approach as the KLG
 * AdminWrapper's BluetoothPrinterManager: connect, write raw ESC/POS bytes,
 * disconnect. The printer must be paired once in Android Bluetooth settings.
 * Callers must hold BLUETOOTH_CONNECT (Android 12+) and run off the main thread.
 */
@SuppressLint("MissingPermission")
final class BluetoothPrinter {
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothPrinter() {}

    static final class Paired {
        final String name;
        final String address;
        final boolean looksLikePrinter;
        Paired(String name, String address, boolean looksLikePrinter) {
            this.name = name;
            this.address = address;
            this.looksLikePrinter = looksLikePrinter;
        }
    }

    static BluetoothAdapter adapter(Context ctx) {
        BluetoothManager bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        return bm != null ? bm.getAdapter() : null;
    }

    static List<Paired> paired(Context ctx) throws IOException {
        BluetoothAdapter a = adapter(ctx);
        if (a == null) throw new IOException("This phone has no Bluetooth");
        if (!a.isEnabled()) throw new IOException("Bluetooth is off. Turn it on and try again.");
        List<Paired> out = new ArrayList<>();
        Set<BluetoothDevice> devices = a.getBondedDevices();
        if (devices == null) return out;
        for (BluetoothDevice d : devices) {
            BluetoothClass c = d.getBluetoothClass();
            boolean printer = c != null && (c.getMajorDeviceClass() == BluetoothClass.Device.Major.IMAGING
                    || c.getMajorDeviceClass() == BluetoothClass.Device.Major.UNCATEGORIZED);
            String name = d.getName() != null ? d.getName() : d.getAddress();
            out.add(new Paired(name, d.getAddress(), printer));
        }
        return out;
    }

    /** Blocking: connects, writes the bytes, disconnects. */
    static void print(Context ctx, String address, byte[] data) throws IOException {
        BluetoothAdapter a = adapter(ctx);
        if (a == null) throw new IOException("This phone has no Bluetooth");
        if (!a.isEnabled()) throw new IOException("Bluetooth is off. Turn it on and try again.");
        if (address == null || !BluetoothAdapter.checkBluetoothAddress(address)) throw new IOException("No printer selected");
        BluetoothDevice device = a.getRemoteDevice(address);
        try { a.cancelDiscovery(); } catch (Exception ignored) {}

        BluetoothSocket socket = null;
        try {
            socket = device.createRfcommSocketToServiceRecord(SPP);
            try {
                socket.connect();
            } catch (IOException first) {
                // Many cheap thermal printers only accept the insecure channel.
                try { socket.close(); } catch (IOException ignored) {}
                socket = device.createInsecureRfcommSocketToServiceRecord(SPP);
                socket.connect();
            }
            OutputStream os = socket.getOutputStream();
            // Small chunks: some printers drop data when their buffer overflows.
            final int chunk = 512;
            for (int i = 0; i < data.length; i += chunk) {
                os.write(data, i, Math.min(chunk, data.length - i));
                os.flush();
                try { Thread.sleep(20); } catch (InterruptedException ignored) {}
            }
            // Let the printer drain before the socket closes, or the tail gets cut off.
            try { Thread.sleep(600); } catch (InterruptedException ignored) {}
        } catch (IOException e) {
            String name = device.getName() != null ? device.getName() : address;
            throw new IOException("Could not reach printer " + name + ". Check it is on and in range. (" + e.getMessage() + ")");
        } finally {
            if (socket != null) try { socket.close(); } catch (IOException ignored) {}
        }
    }
}
