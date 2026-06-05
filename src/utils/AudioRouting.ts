import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface AudioRoutingPlugin {
  startBluetoothSco(): Promise<void>;
  stopBluetoothSco(): Promise<void>;
  requestAudioFocus(): Promise<void>;
  abandonAudioFocus(): Promise<void>;
  addListener(
    eventName: 'onAudioHardwareDisconnected',
    listenerFunc: (info: { event: string }) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(
    eventName: 'onAudioFocusChange',
    listenerFunc: (info: { event: 'loss' | 'gain' }) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  requestPermissions(): Promise<void>;
}

const AudioRouting = registerPlugin<AudioRoutingPlugin>('AudioRouting');

export default AudioRouting;
