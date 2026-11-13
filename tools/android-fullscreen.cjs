// Patch the generated Capacitor Android project: immersive full screen, notch area, keep screen on, landscape.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','android','app','src','main');
const javaDir=path.join(root,'java','com','ironrequiem','game');fs.mkdirSync(javaDir,{recursive:true});
fs.writeFileSync(path.join(javaDir,'MainActivity.java'),`package com.ironrequiem.game;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) { super.onCreate(savedInstanceState); immersive(); }
    @Override public void onResume() { super.onResume(); immersive(); }
    @Override public void onWindowFocusChanged(boolean hasFocus) { super.onWindowFocusChanged(hasFocus); if (hasFocus) immersive(); }
    private void immersive() {
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
`);
const mf=path.join(root,'AndroidManifest.xml');let m=fs.readFileSync(mf,'utf8');
if(!m.includes('screenOrientation'))m=m.replace('<activity','<activity android:screenOrientation="sensorLandscape" android:hardwareAccelerated="true" android:resizeableActivity="false"');
m=m.replace('AppTheme.NoActionBarLaunch','AppTheme.NoActionBar');fs.writeFileSync(mf,m);
const st=path.join(root,'res','values','styles.xml');if(fs.existsSync(st)){let x=fs.readFileSync(st,'utf8');
  x=x.replace(/(<style name="AppTheme.NoActionBar"[^>]*>)/,'$1\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>\n        <item name="android:windowBackground">@android:color/black</item>');fs.writeFileSync(st,x);}
console.log('android fullscreen patch applied');
