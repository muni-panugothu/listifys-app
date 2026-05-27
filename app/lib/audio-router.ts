import { NativeModules } from 'react-native';

const { SpeakerModule } = NativeModules as {
  SpeakerModule?: { setSpeakerphoneOn(enabled: boolean): void };
};

/**
 * Toggle the device speakerphone during an in-call session.
 * Uses a thin native Android AudioManager module.
 */
export function setSpeakerphoneOn(enabled: boolean): void {
  SpeakerModule?.setSpeakerphoneOn(enabled);
}
