/**
 * Web Bluetooth Service for SoundConnect
 * Uses real platform APIs with brand filters to eliminate "Unknown or Unsupported Device" MAC address lists.
 */

declare global {
  interface Navigator {
    bluetooth?: {
      getAvailability?: () => Promise<boolean>;
      requestDevice?: (options?: any) => Promise<any>;
      getDevices?: () => Promise<any[]>;
    };
  }
}

export type BluetoothDevice = any;

export function isBluetoothSupported(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'bluetooth' in navigator && !!navigator.bluetooth;
}

export async function checkBluetoothAvailability(): Promise<boolean> {
  if (!isBluetoothSupported()) return false;
  try {
    if (navigator.bluetooth && 'getAvailability' in navigator.bluetooth && typeof navigator.bluetooth.getAvailability === 'function') {
      return await navigator.bluetooth.getAvailability();
    }
    return true;
  } catch (error) {
    console.warn('Bluetooth availability check failed:', error);
    return false;
  }
}

export async function requestBluetoothDeviceWithBrand(prefix: string, altPrefix?: string): Promise<any | null> {
  if (!isBluetoothSupported() || !navigator.bluetooth || !navigator.bluetooth.requestDevice) {
    throw new Error('Web Bluetooth is not supported in this browser.');
  }

  const filters: any[] = [{ namePrefix: prefix }];
  if (altPrefix && altPrefix !== prefix) {
    filters.push({ namePrefix: altPrefix });
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters,
      optionalServices: ['generic_access', 'battery_service', 'device_information']
    });
    return device;
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      return null; // User cancelled browser chooser
    }
    if (error.name === 'SecurityError') {
      throw new Error('Web Bluetooth requires user interaction or HTTPS context.');
    }
    throw error;
  }
}

export async function getPreviouslyAuthorizedDevices(): Promise<any[]> {
  if (!isBluetoothSupported() || !navigator.bluetooth) return [];
  try {
    if ('getDevices' in navigator.bluetooth && typeof navigator.bluetooth.getDevices === 'function') {
      return await navigator.bluetooth.getDevices();
    }
    return [];
  } catch (error) {
    console.warn('Error retrieving authorized Bluetooth devices:', error);
    return [];
  }
}

export async function connectToDevice(device: any, onDisconnect?: () => void): Promise<boolean> {
  if (!device || !device.gatt) {
    return false;
  }

  try {
    if (!device.gatt.connected) {
      await device.gatt.connect();
    }

    if (onDisconnect && typeof device.addEventListener === 'function') {
      device.addEventListener('gattserverdisconnected', onDisconnect);
    }
    return device.gatt.connected;
  } catch (error) {
    console.warn(`GATT connection warning for ${device.name || device.id}:`, error);
    return false;
  }
}

export function disconnectFromDevice(device: any): void {
  if (device && device.gatt && device.gatt.connected) {
    device.gatt.disconnect();
  }
}

export function handleDisconnect(device: any, callback: () => void): void {
  if (device && typeof device.addEventListener === 'function') {
    device.addEventListener('gattserverdisconnected', callback);
  }
}
