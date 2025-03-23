/**
 * Moodify Vibe Color - Content Script
 * Hand-written code by Bilal Ashraf
 * No code generators or minifiers used
 * This script handles all DOM manipulations for the Moodify extension.
 * It applies color changes to web pages based on mood settings.
 * Includes contrast checking to ensure text readability.
 */

// Store original styles to restore them later
const originalStyles = new Map();

// Configuration for different moods
const moodConfigs = {
  happy: {
    backgroundColor: '#fffde7', // Light yellow
    textColor: '#4527a0',       // Deep purple
    linkColor: '#ff6f00',       // Amber
    accentColor: '#ffeb3b'      // Yellow
  },
  calm: {
    backgroundColor: '#e8f5e9', // Light green
    textColor: '#1a237e',       // Indigo
    linkColor: '#0288d1',       // Light blue
    accentColor: '#80cbc4'      // Teal
  },
  focused: {                    // Changed from 'focus' to 'focused' to match UI
    backgroundColor: '#eceff1', // Light blue-gray
    textColor: '#263238',       // Dark blue-gray
    linkColor: '#0277bd',       // Dark blue
    accentColor: '#b0bec5'      // Blue-gray
  },
  energetic: {
    backgroundColor: '#fff3e0', // Light orange
    textColor: '#bf360c',       // Deep orange
    linkColor: '#e65100',       // Orange
    accentColor: '#ffcc80'      // Light orange
  },
  relaxed: {                    // Changed from 'relax' to 'relaxed' to match UI
    backgroundColor: '#e3f2fd', // Light blue
    textColor: '#1a237e',       // Indigo
    linkColor: '#5e35b1',       // Deep purple
    accentColor: '#bbdefb'      // Light blue
  },
  creative: {                   // Added 'creative' mood to match UI
    backgroundColor: '#f3e5f5', // Light purple
    textColor: '#4a148c',       // Deep purple
    linkColor: '#8e24aa',       // Purple
    accentColor: '#ce93d8'      // Light purple
  },
  custom: {                     // Custom colors defined by user
    backgroundColor: '#ffffff', // Default white
    textColor: '#000000',       // Default black
    linkColor: '#0066cc',       // Default blue
    accentColor: '#cccccc'      // Default gray
  }
};

// System theme detection
let prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Listen for changes in system theme
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    prefersDarkMode = event.matches;
    // Check if we should update based on system theme
    browser.runtime.sendMessage({ action: 'checkSystemTheme' });
  });
}

/**
 * Store the original style of an element before modification
 * @param {Element} element - DOM element to store style for
 */
function saveOriginalStyle(element) {
  if (!originalStyles.has(element)) {
    originalStyles.set(element, {
      backgroundColor: element.style.backgroundColor,
      color: element.style.color,
      borderColor: element.style.borderColor
    });
  }
}

/**
 * Restore all elements to their original styles
 */
function restoreOriginalStyles() {
  originalStyles.forEach((style, element) => {
    if (element && element.style) {
      element.style.backgroundColor = style.backgroundColor;
      element.style.color = style.color;
      element.style.borderColor = style.borderColor;
    }
  });
  
  // Also remove any custom stylesheet we might have added
  const customStylesheet = document.getElementById('moodify-styles');
  if (customStylesheet) {
    customStylesheet.remove();
  }
}

/**
 * Convert hex color to RGB object
 * @param {string} hex - Hex color code (with or without #)
 * @return {Object} RGB object with r, g, b properties
 */
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse hex values
  let r, g, b;
  if (hex.length === 3) {
    // Short notation (e.g. #ABC)
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
  } else {
    // Full notation (e.g. #AABBCC)
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  
  return { r, g, b };
}

/**
 * Calculate relative luminance of a color for WCAG contrast calculations
 * @param {Object} rgb - RGB object with r, g, b properties
 * @return {number} Relative luminance value
 */
function calculateLuminance(rgb) {
  // Convert RGB to sRGB
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;
  
  // Apply gamma correction
  r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  
  // Calculate luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors according to WCAG
 * @param {string} color1 - First color in hex format
 * @param {string} color2 - Second color in hex format
 * @return {number} Contrast ratio (1:1 to 21:1)
 */
function calculateContrastRatio(color1, color2) {
  const lum1 = calculateLuminance(hexToRgb(color1));
  const lum2 = calculateLuminance(hexToRgb(color2));
  
  // Calculate contrast ratio
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Adjust text color to ensure readability based on background color
 * @param {string} bgColor - Background color in hex format
 * @param {string} textColor - Original text color in hex format
 * @param {number} minContrast - Minimum contrast ratio required (WCAG AA: 4.5:1, AAA: 7:1)
 * @return {string} Adjusted text color in hex format
 */
function ensureReadableTextColor(bgColor, textColor, minContrast = 4.5) {
  // Check current contrast
  const currentContrast = calculateContrastRatio(bgColor, textColor);
  
  // If contrast is already sufficient, return original color
  if (currentContrast >= minContrast) {
    return textColor;
  }
  
  // Determine if we should lighten or darken the text
  const bgLuminance = calculateLuminance(hexToRgb(bgColor));
  
  // For dark backgrounds, use white text; for light backgrounds, use black text
  if (bgLuminance < 0.5) {
    return '#ffffff'; // White text for dark backgrounds
  } else {
    return '#000000'; // Black text for light backgrounds
  }
}

/**
 * Apply mood-based color changes to the page
 * @param {string} mood - The mood to apply
 * @param {number} intensity - Intensity of the effect (0-100)
 * @param {number} saturation - Saturation level (0-100), defaults to intensity if not provided
 * @param {number} brightness - Brightness level (0-100), defaults to intensity if not provided
 * @param {Object} customColors - Optional custom colors to use instead of predefined mood
 */
function applyMoodColors(mood, intensity = 50, saturation = null, brightness = null, customColors = null) {
  // First remove any previous modifications
  restoreOriginalStyles();
  
  // If custom colors are provided, update the custom mood config
  if (customColors && mood === 'custom') {
    moodConfigs.custom = {
      backgroundColor: customColors.backgroundColor || '#ffffff',
      textColor: customColors.textColor || '#000000',
      linkColor: customColors.linkColor || '#0066cc',
      accentColor: customColors.accentColor || '#cccccc'
    };
  }
  
  if (!moodConfigs[mood]) {
    console.error(`Mood "${mood}" not found in configurations`);
    return;
  }
  
  const config = moodConfigs[mood];
  const intensityFactor = intensity / 100;
  // Use provided saturation/brightness or fall back to intensity
  const saturationFactor = (saturation !== null ? saturation : intensity) / 100;
  const brightnessFactor = (brightness !== null ? brightness : intensity) / 100;
  
  // Check and adjust text colors for readability
  const adjustedTextColor = ensureReadableTextColor(config.backgroundColor, config.textColor);
  const adjustedLinkColor = ensureReadableTextColor(config.backgroundColor, config.linkColor);
  
  // Add a custom stylesheet for global changes
  let style = document.createElement('style');
  style.id = 'moodify-styles';
  style.textContent = `
    body {
      background-color: ${config.backgroundColor} !important;
      color: ${adjustedTextColor} !important;
      transition: all 0.3s ease-in-out;
    }
    a {
      color: ${adjustedLinkColor} !important;
    }
    button, input, select, textarea {
      border-color: ${config.accentColor} !important;
    }
    ::-moz-selection {
      background-color: ${config.accentColor} !important;
      color: ${adjustedTextColor} !important;
    }
  `;
  document.head.appendChild(style);
  
  // Apply styles to specific elements
  const elementsToModify = [
    ...document.querySelectorAll('div, section, article, header, footer, main, aside, nav')
  ];
  
  // Add a filter to the body based on saturation and brightness
  const saturationFilter = saturationFactor > 1 ? `saturate(${saturationFactor * 100}%)` : `saturate(${saturationFactor * 100}%)`;
  const brightnessFilter = brightnessFactor > 0.5 ? `brightness(${brightnessFactor * 150}%)` : `brightness(${brightnessFactor * 100}%)`;
  
  // Update the style to include filters
  style.textContent += `
    body {
      filter: ${saturationFilter} ${brightnessFilter} !important;
    }
  `;
  
  elementsToModify.forEach(element => {
    // Skip elements that are too small
    if (element.offsetWidth < 50 || element.offsetHeight < 50) {
      return;
    }
    
    saveOriginalStyle(element);
    
    // Apply the style with the intensity factor
    const computedStyle = window.getComputedStyle(element);
    const currentBg = computedStyle.backgroundColor;
    const currentTextColor = computedStyle.color;
    
    if (currentBg && currentBg !== 'rgba(0, 0, 0, 0)' && currentBg !== 'transparent') {
      // Properly blend the current color with the mood color based on intensity
      // Convert hex color to rgba with opacity based on intensity factor
      const hexColor = config.backgroundColor.replace('#', '');
      const r = parseInt(hexColor.substring(0, 2), 16);
      const g = parseInt(hexColor.substring(2, 4), 16);
      const b = parseInt(hexColor.substring(4, 6), 16);
      const newBgColor = `rgba(${r}, ${g}, ${b}, ${intensityFactor})`;
      element.style.backgroundColor = newBgColor;
      
      // Check if the element has text content and ensure readability
      if (element.textContent && element.textContent.trim() !== '') {
        // Convert rgba to hex for contrast calculation
        // For simplicity, we'll use the base mood color for contrast checking
        const adjustedTextColor = ensureReadableTextColor(config.backgroundColor, currentTextColor);
        element.style.color = adjustedTextColor;
      }
    }
  });
}

/**
 * Apply a dark mode filter to the page
 * @param {boolean} enabled - Whether dark mode should be enabled
 * @param {number} intensity - Intensity of the effect (0-100)
 */
function applyDarkMode(enabled, intensity = 80) {
  restoreOriginalStyles();
  
  if (!enabled) return;
  
  const style = document.createElement('style');
  style.id = 'moodify-styles';
  style.textContent = `
    html {
      filter: invert(${intensity}%) hue-rotate(180deg) !important;
    }
    img, video, canvas {
      filter: invert(100%) hue-rotate(180deg) !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Apply a color filter to the page (color blindness simulation or enhancement)
 * @param {string} type - Type of color filter
 */
function applyColorFilter(type) {
  restoreOriginalStyles();
  
  if (!type || type === 'none') return;
  
  const filters = {
    protanopia: 'url("#protanopia-filter")',
    deuteranopia: 'url("#deuteranopia-filter")',
    tritanopia: 'url("#tritanopia-filter")',
    enhance: 'saturate(150%) contrast(110%)'
  };
  
  if (!filters[type]) {
    console.error(`Filter type "${type}" not found`);
    return;
  }
  
  // Add SVG filters for color blindness to the document if needed
  if (['protanopia', 'deuteranopia', 'tritanopia'].includes(type) && 
      !document.getElementById('moodify-color-filters')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'moodify-color-filters';
    svg.style.display = 'none';
    svg.innerHTML = `
      <filter id="protanopia-filter">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0.567, 0.433, 0,     0, 0
                  0.558, 0.442, 0,     0, 0
                  0,     0.242, 0.758, 0, 0
                  0,     0,     0,     1, 0"/>
      </filter>
      <filter id="deuteranopia-filter">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0.625, 0.375, 0,   0, 0
                  0.7,   0.3,   0,   0, 0
                  0,     0.3,   0.7, 0, 0
                  0,     0,     0,   1, 0"/>
      </filter>
      <filter id="tritanopia-filter">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0.95, 0.05,  0,     0, 0
                  0,    0.433, 0.567, 0, 0
                  0,    0.475, 0.525, 0, 0
                  0,    0,     0,     1, 0"/>
      </filter>
    `;
    document.body.appendChild(svg);
  }
  
  const style = document.createElement('style');
  style.id = 'moodify-styles';
  style.textContent = `
    html {
      filter: ${filters[type]} !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Listen for messages from the background script
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'applyMood':
        // Check if we received settings object or direct parameters
        if (message.settings) {
          // Extract mood from settings
          let mood = message.settings.mood || 'calm';
          
          // Check if we should use custom colors
          let customColors = null;
          if (message.settings.customColors && message.settings.customColors.enabled) {
            mood = 'custom';
            customColors = {
              backgroundColor: message.settings.customColors.backgroundColor,
              textColor: message.settings.customColors.textColor,
              linkColor: message.settings.customColors.linkColor,
              accentColor: message.settings.customColors.linkColor // Use link color as accent for simplicity
            };
          }
          
          // Check if we should follow system theme
          if (message.settings.followSystemTheme && prefersDarkMode) {
            // Override with dark mode appropriate colors
            if (mood !== 'custom') {
              // Use focused mood for dark mode as it has darker colors
              mood = 'focused';
            }
          }
          
          // Extract saturation and brightness as separate values
          const saturation = parseInt(message.settings.saturation);
          const brightness = parseInt(message.settings.brightness);
          // For backward compatibility, calculate intensity as average
          const intensity = (saturation + brightness) / 2;
          applyMoodColors(mood, intensity, saturation, brightness, customColors);
        } else {
          // Fallback to direct parameters
          applyMoodColors(message.mood, message.intensity);
        }
        sendResponse({ success: true });
        break;
      case 'applyDarkMode':
        applyDarkMode(message.enabled, message.intensity);
        sendResponse({ success: true });
        break;
      case 'applyColorFilter':
        applyColorFilter(message.type);
        sendResponse({ success: true });
        break;
      case 'removeEffects':
        restoreOriginalStyles();
        sendResponse({ success: true });
        break;
      case 'getStatus':
        // Send back the current status if needed
        sendResponse({
          hasCustomStyles: !!document.getElementById('moodify-styles'),
          prefersDarkMode: prefersDarkMode,
          success: true
        });
        break;
      case 'checkSystemTheme':
        // Check if we should update based on system theme
        browser.runtime.sendMessage({ 
          action: 'getSettings' 
        }, (settings) => {
          if (settings && settings.followSystemTheme) {
            // Re-apply mood with current settings
            browser.runtime.sendMessage({ 
              action: 'applyToCurrentTab' 
            });
          }
        });
        sendResponse({ success: true });
        break;
      default:
        console.error('Unknown action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // Keep the messaging channel open for async responses
});

// Inform the background script that the content script has been loaded
browser.runtime.sendMessage({ action: 'contentScriptLoaded', url: window.location.href });

// Watch for DOM changes to handle dynamically added content
const observer = new MutationObserver((mutations) => {
  // If we have active styles, we may need to apply them to new elements
  if (document.getElementById('moodify-styles')) {
    // Check with the background script what mode is currently active
    browser.runtime.sendMessage({ action: 'getCurrentMode' }, (response) => {
      if (response && response.mode) {
        // Reapply the current mode
        if (response.mode === 'mood') {
          const saturation = parseInt(response.settings.saturation);
          const brightness = parseInt(response.settings.brightness);
          const intensity = response.settings.intensity || ((saturation + brightness) / 2);
          applyMoodColors(response.settings.mood, intensity, saturation, brightness);
        } else if (response.mode === 'darkMode') {
          applyDarkMode(true, response.settings.intensity);
        } else if (response.mode === 'colorFilter') {
          applyColorFilter(response.settings.type);
        }
      }
    });
  }
});

// Start observing the document
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

