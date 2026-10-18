import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { recordDismissal, shouldShowAsk } from '../../utils/telemetryAsk';
import { HelloModal } from './HelloModal';

/**
 * Mounted once in App. Decides on its own whether the admin of the home
 * instance should be asked: `api.admin.telemetry` always talks to the home
 * origin, and `user.isAdmin` is the home account's flag, so a federated
 * account on a remote instance is never asked about that instance. Nobody is
 * asked before a first admin exists, because there is no session then.
 */
export function TelemetryAsk() {
  return null;
}
