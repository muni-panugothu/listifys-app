import { useCallback, useEffect, useRef, useState } from "react";
import { Vibration } from "react-native";

type RefreshHandler = () => Promise<void> | void;
type AudioPlayerLike = {
  volume: number;
  play: () => void;
  seekTo: (seconds: number) => Promise<void>;
  remove: () => void;
};

type RefreshSoundSource = number | { uri: string };

const DEFAULT_REFRESH_SOUND: RefreshSoundSource = {
  uri: "https://actions.google.com/sounds/v1/cartoon/pop.ogg",
};

type UsePullToRefreshOptions = {
  minimumSpinnerMs?: number;
  playSound?: boolean;
  sound?: RefreshSoundSource;
};

export function usePullToRefresh(
  handler?: RefreshHandler,
  options: UsePullToRefreshOptions = {},
) {
  const {
    minimumSpinnerMs = 700,
    playSound = true,
    sound = DEFAULT_REFRESH_SOUND,
  } = options;
  const [refreshing, setRefreshing] = useState(false);
  const playerRef = useRef<AudioPlayerLike | null>(null);
  const audioUnavailableRef = useRef(false);

  const playRefreshSound = useCallback(async () => {
    if (!playSound) {
      return;
    }

    try {
      if (audioUnavailableRef.current) {
        Vibration.vibrate(12);
        return;
      }

      const expoAudio = await import("expo-audio");

      if (!playerRef.current) {
        await expoAudio.setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: "mixWithOthers",
        });

        const createdPlayer = expoAudio.createAudioPlayer(sound, {
          keepAudioSessionActive: true,
        });
        createdPlayer.volume = 0.6;

        playerRef.current = createdPlayer as unknown as AudioPlayerLike;
      }

      const player = playerRef.current;
      if (player) {
        await player.seekTo(0);
        player.play();
      }
    } catch {
      audioUnavailableRef.current = true;
      Vibration.vibrate(12);
    }
  }, [playSound, sound]);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.remove();
        playerRef.current = null;
      }
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const startTime = Date.now();

    try {
      // Run sound + data refresh in parallel so audio issues never block the refresh
      await Promise.all([
        playRefreshSound().catch(() => {}),
        handler?.(),
      ]);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = minimumSpinnerMs - elapsed;

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      setRefreshing(false);
    }
  }, [handler, minimumSpinnerMs, playRefreshSound]);

  return { refreshing, onRefresh };
}
