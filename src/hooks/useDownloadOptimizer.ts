import { useState, useRef, useCallback, useEffect } from 'react';

const COOKIE_KEY = 'download_optimizer_settings';
const OPTIMIZATION_INTERVAL = 5000; // 5 seconds
const SPEED_HISTORY_SIZE = 10; // For moving average
const MIN_CONCURRENCY = 3;
const MAX_CONCURRENCY = 15;
const IMPROVEMENT_THRESHOLD = 1.05; // 5% improvement required

export interface OptimizerSettings {
  enabled: boolean;
  concurrency: number;
  priority: 'high' | 'low' | 'auto';
}

export interface OptimizerStats {
  currentSpeed: number;
  averageSpeed: number;
  adjustments: number;
  optimalConcurrency: number;
}

function loadSettings(): OptimizerSettings {
  try {
    const stored = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${COOKIE_KEY}=`));
    if (stored) {
      return JSON.parse(decodeURIComponent(stored.split('=')[1]));
    }
  } catch (e) {
    console.warn('Failed to load optimizer settings:', e);
  }
  return {
    enabled: false,
    concurrency: 8,
    priority: 'high',
  };
}

function saveSettings(settings: OptimizerSettings) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(settings))}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
}

export function useDownloadOptimizer() {
  const [settings, setSettings] = useState<OptimizerSettings>(loadSettings);
  const [stats, setStats] = useState<OptimizerStats>({
    currentSpeed: 0,
    averageSpeed: 0,
    adjustments: 0,
    optimalConcurrency: settings.concurrency,
  });
  
  const speedHistoryRef = useRef<number[]>([]);
  const lastSpeedRef = useRef<number>(0);
  const trendRef = useRef<number>(1); // 1 = increase, -1 = decrease
  const isExploitingRef = useRef<boolean>(false);
  const exploitationCountRef = useRef<number>(0);
  const adjustmentCountRef = useRef<number>(0);

  // Calculate moving average
  const calculateMovingAverage = useCallback((newSpeed: number): number => {
    speedHistoryRef.current.push(newSpeed);
    if (speedHistoryRef.current.length > SPEED_HISTORY_SIZE) {
      speedHistoryRef.current.shift();
    }
    const sum = speedHistoryRef.current.reduce((a, b) => a + b, 0);
    return sum / speedHistoryRef.current.length;
  }, []);

  // Optimize based on current speed
  const optimize = useCallback((currentSpeed: number) => {
    if (!settings.enabled) return settings.concurrency;

    const averageSpeed = calculateMovingAverage(currentSpeed);
    
    setStats(prev => ({
      ...prev,
      currentSpeed,
      averageSpeed,
    }));

    // Exploitation phase: stick with current settings for a while
    if (isExploitingRef.current) {
      exploitationCountRef.current++;
      // After 24 cycles (2 minutes at 5s interval), re-explore
      if (exploitationCountRef.current >= 24) {
        isExploitingRef.current = false;
        exploitationCountRef.current = 0;
      }
      return settings.concurrency;
    }

    // Exploration phase: adjust parameters
    const speedImprovement = averageSpeed / (lastSpeedRef.current || averageSpeed);
    
    let newConcurrency = settings.concurrency;
    
    if (speedImprovement > IMPROVEMENT_THRESHOLD) {
      // Speed improved - continue in the same direction
      newConcurrency = Math.max(
        MIN_CONCURRENCY,
        Math.min(MAX_CONCURRENCY, settings.concurrency + trendRef.current)
      );
      adjustmentCountRef.current++;
    } else if (speedImprovement < 0.95) {
      // Speed decreased - reverse direction
      trendRef.current *= -1;
      newConcurrency = Math.max(
        MIN_CONCURRENCY,
        Math.min(MAX_CONCURRENCY, settings.concurrency + trendRef.current)
      );
      adjustmentCountRef.current++;
    } else {
      // Speed is stable - we found an optimal point, start exploitation
      isExploitingRef.current = true;
      exploitationCountRef.current = 0;
    }

    lastSpeedRef.current = averageSpeed;

    if (newConcurrency !== settings.concurrency) {
      setSettings(prev => {
        const updated = { ...prev, concurrency: newConcurrency };
        saveSettings(updated);
        return updated;
      });
      
      setStats(prev => ({
        ...prev,
        adjustments: adjustmentCountRef.current,
        optimalConcurrency: newConcurrency,
      }));
    }

    return newConcurrency;
  }, [settings, calculateMovingAverage]);

  // Toggle optimizer
  const setEnabled = useCallback((enabled: boolean) => {
    setSettings(prev => {
      const updated = { ...prev, enabled };
      saveSettings(updated);
      return updated;
    });
    // Reset state when toggling
    speedHistoryRef.current = [];
    lastSpeedRef.current = 0;
    trendRef.current = 1;
    isExploitingRef.current = false;
    exploitationCountRef.current = 0;
  }, []);

  // Manually set concurrency (when optimizer is disabled)
  const setConcurrency = useCallback((concurrency: number) => {
    setSettings(prev => {
      const updated = { 
        ...prev, 
        concurrency: Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, concurrency)) 
      };
      saveSettings(updated);
      return updated;
    });
  }, []);

  // Reset optimizer state for new download
  const reset = useCallback(() => {
    speedHistoryRef.current = [];
    lastSpeedRef.current = 0;
    trendRef.current = 1;
    isExploitingRef.current = false;
    exploitationCountRef.current = 0;
    adjustmentCountRef.current = 0;
    setStats({
      currentSpeed: 0,
      averageSpeed: 0,
      adjustments: 0,
      optimalConcurrency: settings.concurrency,
    });
  }, [settings.concurrency]);

  return {
    settings,
    stats,
    optimize,
    setEnabled,
    setConcurrency,
    reset,
    MIN_CONCURRENCY,
    MAX_CONCURRENCY,
  };
}
