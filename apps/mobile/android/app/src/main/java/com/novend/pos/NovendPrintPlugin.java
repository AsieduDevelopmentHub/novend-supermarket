package com.novend.pos;

import android.content.ContentValues;
import android.content.Context;
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
        String path = call.getString("path");
        String title = call.getString("title", "Receipt");
        File file = resolveFile(path);
        if (file == null || !file.isFile()) {
            call.reject("Receipt PDF was not found on this device.");
            return;
        }
        getActivity()
            .runOnUiThread(() -> {
                try {
                    PrintManager printer =
                        (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                    if (printer == null) {
                        call.reject("Printing is not available on this device.");
                        return;
                    }
                    PrintAttributes attrs = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();
                    printer.print(title, new PdfFileAdapter(file), attrs);
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
