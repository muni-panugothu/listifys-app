const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');
const { logger } = require('../utils/logger');
let uuidv4;

class DeviceService {
  /**
   * Parse user agent to get device info
   * @param {string} userAgent - User agent string
   * @returns {Object} Device information
   */
  parseUserAgent(userAgent) {
    // Handle custom Listify mobile app User-Agent:
    // "Listify/2.4.1 (Xiaomi Redmi Note 11; Android 13)"
    const listifyMatch = userAgent?.match(
      /^Listify\/([\d.]+)\s*\(([^;]+);\s*([^)]+)\)/
    );
    if (listifyMatch) {
      const [, appVersion, deviceModel, osInfo] = listifyMatch;
      const osParts = osInfo.trim().split(/\s+/);
      const osName = osParts[0] || 'Unknown';
      const osVersion = osParts.slice(1).join(' ') || '';
      return {
        browser: `Listify App`,
        browserVersion: appVersion,
        os: osName,
        osVersion,
        device: { model: deviceModel.trim(), type: 'mobile' },
        deviceType: 'mobile',
      };
    }

    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    return {
      browser: result.browser.name || 'Unknown',
      browserVersion: result.browser.version || 'Unknown',
      os: result.os.name || 'Unknown',
      osVersion: result.os.version || 'Unknown',
      device: result.device,
      deviceType: this.getDeviceType(result),
    };
  }

  /**
   * Get device type from parsed result
   * @param {Object} parsed - Parsed user agent
   * @returns {string} Device type
   */
  getDeviceType(parsed) {
    if (parsed.device.type === 'mobile') return 'mobile';
    if (parsed.device.type === 'tablet') return 'tablet';
    if (parsed.device.type === 'wearable') return 'wearable';
    if (parsed.device.type === 'embedded') return 'embedded';
    
    // Check for bot
    if (parsed.device.type === 'bot') return 'bot';
    
    // Default to desktop
    return 'desktop';
  }

  /**
   * Get location from IP address
   * @param {string} ip - IP address
   * @returns {Object|null} Location information
   */
  getLocationFromIP(ip) {
    try {
      // Handle localhost
      if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return {
          country: 'Local',
          city: 'Local',
          region: 'Development',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      const geo = geoip.lookup(ip);
      
      if (geo) {
        return {
          country: geo.country,
          city: geo.city,
          region: geo.region,
          latitude: geo.ll?.[0],
          longitude: geo.ll?.[1],
          timezone: geo.timezone,
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Location lookup error:', error);
      return null;
    }
  }

  /**
   * Generate device ID
   * @param {Object} deviceInfo - Device information
   * @returns {string} Device ID
   */
  generateDeviceId(deviceInfo) {
    const string = `${deviceInfo.browser}-${deviceInfo.os}-${deviceInfo.deviceType}`;
    return require('crypto').createHash('sha256').update(string).digest('hex').substring(0, 32);
  }

  /**
   * Get device name for display
   * @param {Object} deviceInfo - Device information
   * @returns {string} Device name
   */
  getDeviceName(deviceInfo) {
    const { browser, os, deviceType } = deviceInfo;
    
    if (deviceType === 'mobile' && deviceInfo.device?.model) {
      return `${deviceInfo.device.model} (${os})`;
    }
    
    if (deviceType === 'tablet') {
      return `Tablet - ${os}`;
    }
    
    return `${browser} on ${os}`;
  }

  /**
   * Create device session object
   * @param {Object} req - Express request object
   * @param {string} tokenId - JWT token ID
   * @returns {Object} Device session
   */
  async createDeviceSession(req, tokenId) {
    if (!uuidv4) {
      const uuid = await import('uuid');
      uuidv4 = uuid.v4;
    }
    const userAgent = req.get('user-agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress;
    
    const parsedInfo = this.parseUserAgent(userAgent);
    const location = this.getLocationFromIP(ip);
    const deviceId = this.generateDeviceId(parsedInfo);
    const deviceName = this.getDeviceName(parsedInfo);

    return {
      deviceId,
      deviceName,
      deviceType: parsedInfo.deviceType,
      browser: parsedInfo.browser,
      browserVersion: parsedInfo.browserVersion,
      os: parsedInfo.os,
      osVersion: parsedInfo.osVersion,
      ipAddress: ip,
      location,
      firstSeen: new Date(),
      lastSeen: new Date(),
      isCurrentDevice: true,
      userAgent,
      sessions: [{
        sessionId: uuidv4(),
        tokenId,
        loginTime: new Date(),
        lastActivity: new Date(),
        isActive: true,
      }],
    };
  }

  /**
   * Format device for frontend display
   * @param {Object} device - Device object
   * @returns {Object} Formatted device
   */
  formatDeviceForDisplay(device) {
    const lastSeen = new Date(device.lastSeen);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
    
    let lastActiveText = 'Just now';
    if (diffMinutes > 0) {
      if (diffMinutes < 60) {
        lastActiveText = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      } else if (diffMinutes < 1440) {
        const hours = Math.floor(diffMinutes / 60);
        lastActiveText = `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(diffMinutes / 1440);
        lastActiveText = `${days} day${days > 1 ? 's' : ''} ago`;
      }
    }

    // Build location string with full country name
    let locationStr = 'Unknown';
    const loc = device.location;
    if (loc) {
      let country = loc.country || '';
      // Convert ISO code to full name (IN → India, US → United States)
      if (country && country.length === 2 && country !== 'Local') {
        try {
          const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
          country = countryNames.of(country) || country;
        } catch (_) { /* keep ISO code */ }
      }
      const parts = [loc.city, loc.region, country].filter(
        (p) => p && p !== 'Local' && p !== 'Development'
      );
      locationStr = parts.length > 0 ? parts.join(', ') : 'Local Network';
    }

    return {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      location: locationStr,
      timezone: loc?.timezone || null,
      ipAddress: device.ipAddress,
      lastSeen: device.lastSeen,
      lastActiveText,
      isCurrentDevice: device.isCurrentDevice,
      sessions: device.sessions,
    };
  }
}

module.exports = new DeviceService();