package at.modellblick;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Gibt exportierte Dateien (STL/3MF/PNG aus dem Cache-Ordner "exports") schreibgeschützt an andere Apps weiter,
 * z. B. beim Teilen an Bambu Handy, Google Drive oder WhatsApp. Nicht exportiert – Zugriff nur über
 * die beim Teilen erteilte Leseberechtigung für genau diese eine Datei.
 */
public class ExportProvider extends ContentProvider {

    static final String AUTHORITY = "at.modellblick.export";

    static File exportDir(Context c) {
        return new File(c.getCacheDir(), "exports");
    }

    static Uri uriFor(File f) {
        return new Uri.Builder().scheme("content").authority(AUTHORITY).appendPath(f.getName()).build();
    }

    private File fileFor(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        Context c = getContext();
        if (c == null || name == null || name.isEmpty() || name.contains("/") || name.contains("\\") || name.startsWith(".")) {
            throw new FileNotFoundException("invalid");
        }
        File f = new File(exportDir(c), name);
        if (!f.isFile()) throw new FileNotFoundException(name);
        return f;
    }

    @Override public boolean onCreate() { return true; }

    @Override
    public String getType(Uri uri) {
        String n = uri.getLastPathSegment() == null ? "" : uri.getLastPathSegment().toLowerCase();
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".stl")) return "model/stl";
        if (n.endsWith(".3mf")) return "model/3mf";
        return "application/octet-stream";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (mode == null || !mode.equals("r")) throw new SecurityException("read only");
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        File f;
        try { f = fileFor(uri); } catch (FileNotFoundException e) { return null; }
        String[] cols = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
        MatrixCursor c = new MatrixCursor(cols, 1);
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) row[i] = f.getName();
            else if (OpenableColumns.SIZE.equals(cols[i])) row[i] = f.length();
        }
        c.addRow(row);
        return c;
    }

    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String s, String[] a) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { throw new UnsupportedOperationException(); }
}
