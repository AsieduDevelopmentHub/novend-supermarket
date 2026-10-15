package com.novend.millies;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Android print / save for receipt PDFs. WebView {@code window.print()} never
 * opens PrintManager and leaves Chrome stuck on "Opening…".
 */
@CapacitorPlugin(name = "NovendPrint")
public class NovendPrintPlugin extends Plugin {

    @PluginMethod
    public void printPdf(PluginCall call) {
        String title = call.getString("title", "Receipt");
        String data = call.getString("data");
        File file = null;
        if (data != null && !data.isEmpty()) {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                File dir = getContext().getCacheDir();
                file = File.createTempFile("novend-print-", ".pdf", dir);
                try (OutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
            } catch (Exception error) {
                call.reject("Could not prepare the receipt PDF.");
                return;
            }
        } else {
            String path = call.getString("path");
            file = resolveFile(path);
        }
        if (file == null || !file.isFile()) {
            call.reject("Receipt PDF was not found on this device.");
            return;
        }
        final File pdfFile = file;
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Could not open the print dialog.");
            return;
        }
        activity.runOnUiThread(() -> {
                try {
                    PrintManager printer =
                        (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                    if (printer == null) {
                        call.reject("Printing is not available on this device.");
                        return;
                    }

                    PrintAttributes attrs = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();
                    printer.print(title, new PdfFileAdapter(pdfFile), attrs);
                    call.resolve();
                } catch (Exception error) {
                    call.reject(
                        error.getMessage() != null
                            ? error.getMessage()
                            : "Could not open the print dialog."
                    );
                }
            });
    }

    @PluginMethod
    public void savePdfToDownloads(PluginCall call) {
        String fileName = call.getString("fileName", "receipt.pdf");
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Receipt PDF data is missing.");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("Receipt PDF data is invalid.");
            return;
        }

        String safeName = fileName.replaceAll("[^A-Za-z0-9._-]+", "_");
        if (!safeName.toLowerCase().endsWith(".pdf")) {
            safeName = safeName + ".pdf";
        }

        try {
            Uri uri = writeDownloads(safeName, bytes);
            JSObject result = new JSObject();
            result.put("uri", uri != null ? uri.toString() : "");
            result.put("fileName", safeName);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(
                error.getMessage() != null
                    ? error.getMessage()
                    : "Could not save the receipt PDF."
            );
        }
    }

    @PluginMethod
    public void sharePdf(PluginCall call) {
        String title = call.getString("title", "Receipt");
        String fileName = call.getString("fileName", "receipt.pdf");
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Receipt PDF data is missing.");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Unable to share right now. Please try again.");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("Receipt PDF data is invalid.");
            return;
        }
        String safeName = fileName.replaceAll("[^A-Za-z0-9._-]+", "_");
        if (!safeName.toLowerCase().endsWith(".pdf")) {
            safeName = safeName + ".pdf";
        }
        try {
            File file = new File(getContext().getCacheDir(), safeName);
            try (OutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType("application/pdf");
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.putExtra(Intent.EXTRA_SUBJECT, title);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(Intent.createChooser(share, title));
            call.resolve();
        } catch (Exception error) {
            call.reject(
                error.getMessage() != null
                    ? error.getMessage()
                    : "Unable to share right now. Please try again."
            );
        }
    }

    private Uri writeDownloads(String fileName, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = getContext()
                .getContentResolver()
                .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new IllegalStateException("Could not create the Downloads entry.");
            }
            try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
                if (out == null) {
                    throw new IllegalStateException("Could not write the PDF.");
                }
                out.write(bytes);
            }
            return uri;
        }

        File downloads = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloads == null) {
            throw new IllegalStateException("Could not open app Downloads.");
        }
        if (!downloads.exists() && !downloads.mkdirs()) {
            throw new IllegalStateException("Could not open Downloads.");
        }
        File target = new File(downloads, fileName);
        try (OutputStream out = new FileOutputStream(target)) {
            out.write(bytes);
        }
        return Uri.fromFile(target);
    }

    private File resolveFile(String path) {
        if (path == null || path.isEmpty()) {
            return null;
        }
        String normalized = path;
        if (normalized.contains("_capacitor_file_")) {
            normalized = normalized.substring(normalized.indexOf("_capacitor_file_") + 16);
        }
        if (normalized.startsWith("file://")) {
            normalized = Uri.parse(normalized).getPath();
        }
        if (normalized == null || normalized.isEmpty()) {
            return null;
        }
        return new File(normalized);
    }

    private static final class PdfFileAdapter extends PrintDocumentAdapter {
        private final File pdfFile;

        PdfFileAdapter(File pdfFile) {
            this.pdfFile = pdfFile;
        }

        @Override
        public void onLayout(
            PrintAttributes oldAttributes,
            PrintAttributes newAttributes,
            android.os.CancellationSignal cancellationSignal,
            LayoutResultCallback callback,
            android.os.Bundle extras
        ) {
            if (cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }
            PrintDocumentInfo info = new PrintDocumentInfo.Builder(pdfFile.getName())
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                .build();
            callback.onLayoutFinished(info, true);
        }

        @Override
        public void onWrite(
            PageRange[] pages,
            ParcelFileDescriptor destination,
            android.os.CancellationSignal cancellationSignal,
            WriteResultCallback callback
        ) {
            try (
                InputStream in = new FileInputStream(pdfFile);
                OutputStream out = new FileOutputStream(destination.getFileDescriptor())
            ) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) >= 0) {
                    if (cancellationSignal.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    out.write(buffer, 0, read);
                }
                callback.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
            } catch (Exception error) {
                callback.onWriteFailed(
                    error.getMessage() != null ? error.getMessage() : "Could not print the PDF."
                );
            }
        }
    }
}
