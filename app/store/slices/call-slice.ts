import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type CallType = 'audio' | 'video';
export type CallStatus =
  | 'idle'
  | 'outgoing'   // we placed the call, waiting for answer
  | 'incoming'   // receiving a call
  | 'active'     // call connected
  | 'ended';

export interface CallState {
  status:      CallStatus;
  callId:      string | null;
  remoteUserId: string | null;
  remoteUserName: string | null;
  remoteUserPhoto: string | null;
  callType:    CallType;
  // WebRTC signaling payloads (kept in store so screens can read them)
  pendingOffer: object | null;
  // Active call metadata
  startedAt:   number | null;  // Date.now() when call was accepted
  isMuted:     boolean;
  isSpeaker:   boolean;
  isCameraOff: boolean;
}

const initialState: CallState = {
  status:          'idle',
  callId:          null,
  remoteUserId:    null,
  remoteUserName:  null,
  remoteUserPhoto: null,
  callType:        'audio',
  pendingOffer:    null,
  startedAt:       null,
  isMuted:         false,
  isSpeaker:       false,
  isCameraOff:     false,
};

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    outgoingCallStarted(
      state,
      action: PayloadAction<{
        callId: string;
        remoteUserId: string;
        remoteUserName: string;
        remoteUserPhoto: string;
        callType: CallType;
      }>
    ) {
      state.status          = 'outgoing';
      state.callId          = action.payload.callId;
      state.remoteUserId    = action.payload.remoteUserId;
      state.remoteUserName  = action.payload.remoteUserName;
      state.remoteUserPhoto = action.payload.remoteUserPhoto;
      state.callType        = action.payload.callType;
      state.pendingOffer    = null;
      state.startedAt       = null;
      state.isMuted         = false;
      state.isSpeaker       = false;
      state.isCameraOff     = false;
    },

    incomingCallReceived(
      state,
      action: PayloadAction<{
        callId: string;
        remoteUserId: string;
        remoteUserName: string;
        remoteUserPhoto: string;
        callType: CallType;
        offer: object;
      }>
    ) {
      state.status          = 'incoming';
      state.callId          = action.payload.callId;
      state.remoteUserId    = action.payload.remoteUserId;
      state.remoteUserName  = action.payload.remoteUserName;
      state.remoteUserPhoto = action.payload.remoteUserPhoto;
      state.callType        = action.payload.callType;
      state.pendingOffer    = action.payload.offer;
    },

    callConnected(state) {
      state.status    = 'active';
      state.startedAt = Date.now();
    },

    callEnded(state) {
      return { ...initialState, status: 'ended' };
    },

    callReset(state) {
      return initialState;
    },

    toggleMute(state) {
      state.isMuted = !state.isMuted;
    },

    toggleSpeaker(state) {
      state.isSpeaker = !state.isSpeaker;
    },

    toggleCamera(state) {
      state.isCameraOff = !state.isCameraOff;
    },
  },
});

export const {
  outgoingCallStarted,
  incomingCallReceived,
  callConnected,
  callEnded,
  callReset,
  toggleMute,
  toggleSpeaker,
  toggleCamera,
} = callSlice.actions;

export default callSlice.reducer;
