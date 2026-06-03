package com.asicme.chat;

import android.content.Context;
import android.media.AudioManager;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.content.BroadcastReceiver;
import android.content.Intent;
import android.content.IntentFilter;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "AudioRouting")
public class AudioRoutingPlugin extends Plugin {

    private static final String TAG = "AudioRoutingPlugin";
    private BroadcastReceiver noisyReceiver;
    private AudioManager.OnAudioFocusChangeListener audioFocusChangeListener;

    @Override
    public void load() {
        super.load();
        noisyReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                    Log.w(TAG, "Audio hardware disconnected (Becoming Noisy).");
                    JSObject ret = new JSObject();
                    ret.put("event", "disconnected");
                    notifyListeners("onAudioHardwareDisconnected", ret);
                }
            }
        };
        getContext().registerReceiver(noisyReceiver, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));

        audioFocusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
            @Override
            public void onAudioFocusChange(int focusChange) {
                JSObject ret = new JSObject();
                if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
                    ret.put("event", "gain");
                    notifyListeners("onAudioFocusChange", ret);
                } else if (focusChange == AudioManager.AUDIOFOCUS_LOSS ||
                           focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT ||
                           focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
                    ret.put("event", "loss");
                    notifyListeners("onAudioFocusChange", ret);
                }
            }
        };
    }

    @Override
    protected void handleOnDestroy() {
        if (noisyReceiver != null) {
            try {
                getContext().unregisterReceiver(noisyReceiver);
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering receiver", e);
            }
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void startBluetoothSco(PluginCall call) {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                audioManager.startBluetoothSco();
                audioManager.setBluetoothScoOn(true);
                Log.d(TAG, "Bluetooth SCO Started and Mode set to IN_COMMUNICATION");
                call.resolve();
            } else {
                call.reject("AudioManager not found");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting Bluetooth SCO", e);
            call.reject("Error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopBluetoothSco(PluginCall call) {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setBluetoothScoOn(false);
                audioManager.stopBluetoothSco();
                audioManager.setMode(AudioManager.MODE_NORMAL);
                Log.d(TAG, "Bluetooth SCO Stopped and Mode set to NORMAL");
                call.resolve();
            } else {
                call.reject("AudioManager not found");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping Bluetooth SCO", e);
            call.reject("Error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestAudioFocus(PluginCall call) {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                int result = audioManager.requestAudioFocus(
                    audioFocusChangeListener, 
                    AudioManager.STREAM_VOICE_CALL, 
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                );
                if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    Log.d(TAG, "Audio focus requested and granted");
                    call.resolve();
                } else {
                    call.reject("Audio focus request denied");
                }
            } else {
                call.reject("AudioManager not found");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error requesting audio focus", e);
            call.reject("Error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void abandonAudioFocus(PluginCall call) {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null && audioFocusChangeListener != null) {
                audioManager.abandonAudioFocus(audioFocusChangeListener);
                Log.d(TAG, "Audio focus abandoned");
                call.resolve();
            } else {
                call.reject("AudioManager not found");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error abandoning audio focus", e);
            call.reject("Error: " + e.getMessage());
        }
    }
}
