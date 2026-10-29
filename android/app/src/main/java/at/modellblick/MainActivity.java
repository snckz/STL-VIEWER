package at.modellblick;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceResponse;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Hülle um den Web-Viewer (assets/index.html). Kümmert sich um:
 * Dateiauswahl, "Öffnen mit"/"Teilen", Speichern von Bildern in der Galerie.
 *
 * Die Seite läuft unter https://appassets.androidplatform.net/ (für Apps reservierter Host, verlässt nie das Gerät).
 * Dateien aus den Assets und geteilte Dateien werden in shouldInterceptRequest direkt als Stream ausgeliefert –
 * so bleibt der Speicherbedarf auch bei großen STL-Dateien klein.
 */
public class MainActivity extends Activity {

    private static final int REQ_PICK_FILE = 41;
    private static final String HOST = "appassets.androidplatform.net";
    private static final String BASE = "https://" + HOST + "/";
    private static final String SHARED_PREFIX = "/shared/";

    private WebView webView;
    private ValueCallback<Uri[]> pendingChooser;
    private Uri pendingIntentUri;
    private boolean pageReady = false;
    /** Geteilte Dateien, die der Viewer per fetch() abholen darf (id → Uri). */
    private final Map<String, Uri> sharedFiles = Collections.synchronizedMap(new HashMap<>());

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#14171C"));
        getWindow().setNavigationBarColor(Color.parseColor("#1B1F26"));

        createWebView(savedInstanceState);
        boolean fromHistory = (getIntent() != null)
                && (getIntent().getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0;
        if (savedInstanceState == null && !fromHistory) {
            handleIntent(getIntent());
        }
    }

    private void createWebView(Bundle savedInstanceState) {
        pageReady = false;
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#14171C"));
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);

        webView.addJavascriptInterface(new Bridge(), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serve(request.getUrl());
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // WebView-Prozess abgestürzt (z. B. Speicher voll): neu aufbauen statt die App zu beenden
                if (webView == view) {
                    createWebView(null);   // ersetzt die View in setContentView
                    view.destroy();
                    toast("Die Ansicht wurde neu gestartet. Die Datei war vermutlich zu groß für den Speicher.");
                }
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                // Externe Links im Browser öffnen, nie in der App
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                if (pendingIntentUri != null) {
                    Uri u = pendingIntentUri;
                    pendingIntentUri = null;
                    openUri(u);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingChooser != null) pendingChooser.onReceiveValue(null);
                pendingChooser = callback;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*"); // STL hat keinen verlässlichen MIME-Typ – deshalb alle Dateien zulassen
                try {
                    startActivityForResult(i, REQ_PICK_FILE);
                } catch (Exception e) {
                    pendingChooser = null;
                    toast("Kein Dateimanager gefunden.");
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        }
        if (webView.getUrl() == null) {
            webView.loadUrl(BASE + "index.html");
        }
    }

    /** Liefert Assets und freigegebene Dateien an die WebView aus; alles andere geht normal ins Netz. */
    private WebResourceResponse serve(Uri url) {
        if (url == null || !HOST.equals(url.getHost())) return null;
        String path = url.getPath() == null ? "/" : url.getPath();
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        try {
            if (path.startsWith(SHARED_PREFIX)) {
                Uri file = sharedFiles.remove(path.substring(SHARED_PREFIX.length()));
                if (file == null) return error(404, "Not Found");
                InputStream in = getContentResolver().openInputStream(file);
                if (in == null) return error(404, "Not Found");
                return new WebResourceResponse("application/octet-stream", null, 200, "OK", headers, in);
            }
            String asset = path.equals("/") ? "index.html" : path.substring(1);
            if (asset.contains("..")) return error(403, "Forbidden");
            InputStream in = getAssets().open(asset);
            return new WebResourceResponse(mimeFor(asset), mimeFor(asset).startsWith("text/") ? "utf-8" : null, 200, "OK", headers, in);
        } catch (Exception e) {
            return error(404, "Not Found");
        }
    }

    private static WebResourceResponse error(int code, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason, new HashMap<>(), null);
    }

    private static String mimeFor(String name) {
        String n = name.toLowerCase();
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".js")) return "text/javascript";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".svg")) return "image/svg+xml";
        if (n.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(intent.getAction())) {
            if (Build.VERSION.SDK_INT >= 33) {
                uri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            } else {
                uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            }
        }
        if (uri == null) return;
        if (pageReady) openUri(uri); else pendingIntentUri = uri;
    }

    /** Gibt eine geteilte/geöffnete Datei für den Viewer frei; der lädt sie per fetch() als Stream. */
    private void openUri(final Uri uri) {
        String id = UUID.randomUUID().toString();
        sharedFiles.put(id, uri);
        String name = displayName(uri);
        js("window.loadModelUrl(" + JSONObject.quote(name) + "," + JSONObject.quote(BASE + "shared/" + id) + ")");
    }

    private String displayName(Uri uri) {
        String result = null;
        if (ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())) {
            try (Cursor c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst()) result = c.getString(0);
            } catch (Exception ignored) { }
        }
        if (result == null) result = uri.getLastPathSegment();
        return result == null ? "modell.stl" : result;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_PICK_FILE || pendingChooser == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) {
            result = new Uri[]{data.getData()};
        }
        pendingChooser.onReceiveValue(result);
        pendingChooser = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        io.shutdownNow();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private void js(String code) {
        if (webView != null) webView.evaluateJavascript(code, null);
    }

    private void toast(String text) {
        Toast.makeText(this, text, Toast.LENGTH_SHORT).show();
    }

    /** Wird im JavaScript als window.Android angesprochen. */
    private class Bridge {
        @JavascriptInterface
        public void saveImage(String base64Png, String fileName) {
            io.execute(() -> {
                String safe = fileName == null ? "modellblick.png" : fileName.replaceAll("[^\\w.\\-]", "_");
                try {
                    byte[] bytes = Base64.decode(base64Png, Base64.DEFAULT);
                    String where;
                    if (Build.VERSION.SDK_INT >= 29) {
                        ContentValues v = new ContentValues();
                        v.put(MediaStore.Images.Media.DISPLAY_NAME, safe);
                        v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                        v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Modellblick");
                        Uri u = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                        if (u == null) throw new IllegalStateException("insert");
                        try (OutputStream out = getContentResolver().openOutputStream(u)) {
                            if (out == null) throw new IllegalStateException("stream");
                            out.write(bytes);
                        }
                        where = "Bilder/Modellblick";
                    } else {
                        File dir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
                        if (dir == null) throw new IllegalStateException("dir");
                        File f = new File(dir, safe);
                        try (FileOutputStream out = new FileOutputStream(f)) { out.write(bytes); }
                        where = f.getParent();
                    }
                    final String msg = "Bild gespeichert in " + where;
                    main.post(() -> toast(msg));
                } catch (Exception e) {
                    main.post(() -> toast("Bild konnte nicht gespeichert werden."));
                }
            });
        }
    }
}
