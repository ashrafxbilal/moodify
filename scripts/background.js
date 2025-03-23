/**
 * Background script for the Moodify Vibe Color Firefox extension
 * Hand-written code by Bilal Ashraf
 * No code generators or minifiers used
 * This script handles extension initialization, messaging between
 * different parts of the extension, and browser events.
 */

// Default settings for the extension
const defaultSettings = {
  enabled: true,
  mood: 'calm',
  saturation: 50,
  brightness: 50,
  applyToImages: false,
  textReadability: true,
  followSystemTheme: false,
  siteSpecific: {
    enabled: false,
    sites: {}
  },
  timeBased: {
    enabled: false,
    dayMood: 'focused',
    nightMood: 'calm'
  },
  customColors: {
    enabled: false,
    backgroundColor: '#ffffff',
    textColor: '#000000',
    linkColor: '#0066cc'
  },
  excludedDomains: []
};

// Time-based mood scheduler
let timeBasedMoodInterval = null;

// Color profiles based on moods
const moodProfiles = {
  calm: {
    primary: '#4a6fa5',
    secondary: '#c9dae9',
    accent: '#90b4d9',
    text: '#333333'
  },
  energetic: {
    primary: '#e85d04',
    secondary: '#ffbd69',
    accent: '#ff9e00',
    text: '#212121'
  },
  focused: {
    primary: '#2d3142',
    secondary: '#e8eddf',
    accent: '#4f5d75',
    text: '#333333'
  },
  creative: {
    primary: '#9b5de5',
    secondary: '#f8f9fa',
    accent: '#c77dff',
    text: '#333333'
  },
  relaxed: {
    primary: '#5fa8d3',
    secondary: '#cae9ff',
    accent: '#a5d8ff',
    text: '#333333'
  }
};

// Initialize extension settings
function initializeExtension() {
  browser.storage.local.get('settings').then(result => {
    if (!result.settings) {
      // If no settings exist, use default
      browser.storage.local.set({ settings: defaultSettings });
      console.log("Extension initialized with default settings");
    } else {
      console.log("Extension initialized with existing settings");
      
      // Start time-based automation if enabled
      if (result.settings.timeBased && result.settings.timeBased.enabled) {
        startTimeBasedAutomation(result.settings);
      }
    }
  }).catch(error => {
    console.error("Error initializing extension:", error);
  });
}

// Start time-based mood automation
function startTimeBasedAutomation(settings) {
  // Clear any existing interval
  if (timeBasedMoodInterval) {
    clearInterval(timeBasedMoodInterval);
  }
  
  // Function to check time and apply appropriate mood
  function checkTimeAndApplyMood() {
    const currentHour = new Date().getHours();
    const isDaytime = currentHour >= 6 && currentHour < 18; // 6AM to 6PM
    
    // Create a copy of settings to modify
    const timeBasedSettings = JSON.parse(JSON.stringify(settings));
    
    // Set the mood based on time of day
    if (isDaytime) {
      timeBasedSettings.mood = settings.timeBased.dayMood || 'focused';
    } else {
      timeBasedSettings.mood = settings.timeBased.nightMood || 'calm';
    }
    
    // Apply to all open tabs
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        // Skip applying to extension pages and certain domains
        if (tab.url.startsWith('about:') || 
            tab.url.startsWith('moz-extension:') ||
            tab.url.startsWith('chrome:')) {
          return;
        }
        
        // Check if domain is excluded
        try {
          const url = new URL(tab.url);
          const domain = url.hostname;
          if (settings.excludedDomains.includes(domain)) {
            return;
          }
          
          // Apply site-specific settings if available
          if (settings.siteSpecific && settings.siteSpecific.enabled && 
              settings.siteSpecific.sites && settings.siteSpecific.sites[domain]) {
            const siteSettings = settings.siteSpecific.sites[domain];
            const customSettings = JSON.parse(JSON.stringify(timeBasedSettings));
            
            // Override with site-specific settings
            if (siteSettings.mood) customSettings.mood = siteSettings.mood;
            if (siteSettings.saturation !== undefined) customSettings.saturation = siteSettings.saturation;
            if (siteSettings.brightness !== undefined) customSettings.brightness = siteSettings.brightness;
            
            browser.tabs.sendMessage(tab.id, {
              action: 'applyMood',
              settings: customSettings
            }).catch(() => {
              // Ignore errors for tabs that don't have content script running
            });
          } else {
            // Apply time-based settings
            browser.tabs.sendMessage(tab.id, {
              action: 'applyMood',
              settings: timeBasedSettings
            }).catch(() => {
              // Ignore errors for tabs that don't have content script running
            });
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      });
    });
  }
  
  // Check immediately on start
  checkTimeAndApplyMood();
  
  // Then check every 15 minutes
  timeBasedMoodInterval = setInterval(checkTimeAndApplyMood, 15 * 60 * 1000);
}

// Set up message listeners for communication between scripts
function setupMessageListeners() {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'getSettings':
        browser.storage.local.get('settings').then(result => {
          sendResponse(result.settings || defaultSettings);
        }).catch(error => {
          console.error("Error retrieving settings:", error);
          sendResponse(defaultSettings);
        });
        return true; // Required for async sendResponse

      case 'saveSettings':
        browser.storage.local.set({ settings: message.settings }).then(() => {
          sendResponse({ success: true });
          // Notify content scripts of the change
          notifySettingsChange(message.settings);
          
          // Handle time-based automation
          if (message.settings.timeBased) {
            if (message.settings.timeBased.enabled) {
              startTimeBasedAutomation(message.settings);
            } else if (timeBasedMoodInterval) {
              clearInterval(timeBasedMoodInterval);
              timeBasedMoodInterval = null;
            }
          }
        }).catch(error => {
          console.error("Error saving settings:", error);
          sendResponse({ success: false, error: error.message });
        });
        return true;

      case 'getMoodProfile':
        const profile = moodProfiles[message.mood] || moodProfiles.calm;
        sendResponse(profile);
        return true;

      case 'applyToCurrentTab':
        applyToCurrentTab(message.settings || null);
        sendResponse({ success: true });
        return true;

      case 'resetCurrentTab':
        resetCurrentTab();
        sendResponse({ success: true });
        return true;
    }
  });
}

// Notify all content scripts about settings changes
function notifySettingsChange(settings) {
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      browser.tabs.sendMessage(tab.id, {
        action: 'settingsUpdated',
        settings: settings
      }).catch(error => {
        // Ignore errors for tabs that don't have content script running
        if (!error.message.includes("Could not establish connection")) {
          console.error(`Error sending message to tab ${tab.id}:`, error);
        }
      });
    });
  });
}

// Apply color modifications to the current tab
function applyToCurrentTab(customSettings = null) {
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs.length === 0) return;
    
    let currentTab = tabs[0];
    
    // Skip applying to extension pages and certain domains
    if (currentTab.url.startsWith('about:') || 
        currentTab.url.startsWith('moz-extension:') ||
        currentTab.url.startsWith('chrome:')) {
      return;
    }
    
    // Get settings and apply to current tab
    if (customSettings) {
      browser.tabs.sendMessage(currentTab.id, {
        action: 'applyMood',
        settings: customSettings
      });
    } else {
      browser.storage.local.get('settings').then(result => {
        let settings = result.settings || defaultSettings;
        browser.tabs.sendMessage(currentTab.id, {
          action: 'applyMood',
          settings: settings
        });
      });
    }
  });
}

// Reset color modifications on the current tab
function resetCurrentTab() {
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs.length > 0) {
      browser.tabs.sendMessage(tabs[0].id, { action: 'reset' });
    }
  });
}

// Check if we should apply color modifications when a tab is updated
function handleTabUpdated(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    browser.storage.local.get('settings').then(result => {
      let settings = result.settings || defaultSettings;
      
      // Skip if extension is disabled
      if (!settings.enabled) return;
      
      // Skip applying to extension pages and certain domains
      if (tab.url.startsWith('about:') || 
          tab.url.startsWith('moz-extension:') ||
          tab.url.startsWith('chrome:')) {
        return;
      }
      
      // Check if domain is excluded
      const url = new URL(tab.url);
      const domain = url.hostname;
      if (settings.excludedDomains.includes(domain)) {
        return;
      }
      
      // Apply automatically if set
      if (settings.autoApply) {
        setTimeout(() => { // Short delay to ensure page is fully loaded
          browser.tabs.sendMessage(tabId, {
            action: 'applyMood',
            settings: settings
          }).catch(error => {
            // Content script might not be loaded yet, which is normal
            if (!error.message.includes("Could not establish connection")) {
              console.error(`Error sending message to tab ${tabId}:`, error);
            }
          });
        }, 500);
      }
    });
  }
}

// Register handlers for various browser events
function registerEventHandlers() {
  // Handle tab updates
  browser.tabs.onUpdated.addListener(handleTabUpdated);
  
  // Handle tab activation changes
  browser.tabs.onActivated.addListener(activeInfo => {
    browser.storage.local.get('settings').then(result => {
      let settings = result.settings || defaultSettings;
      if (settings.enabled && settings.autoApply) {
        // Short delay to ensure tab is ready
        setTimeout(() => {
          browser.tabs.get(activeInfo.tabId).then(tab => {
            // Skip applying to extension pages and certain domains
            if (tab.url.startsWith('about:') || 
                tab.url.startsWith('moz-extension:') ||
                tab.url.startsWith('chrome:')) {
              return;
            }
            
            // Check if domain is excluded
            try {
              const url = new URL(tab.url);
              const domain = url.hostname;
              if (settings.excludedDomains.includes(domain)) {
                return;
              }
              
              browser.tabs.sendMessage(activeInfo.tabId, {
                action: 'applyMood',
                settings: settings
              }).catch(() => {
                // Ignore errors for tabs that don't have content script running
              });
            } catch (e) {
              // Ignore invalid URLs
            }
          });
        }, 300);
      }
    });
  });
  
  // Handle extension installation or update
  browser.runtime.onInstalled.addListener(details => {
    if (details.reason === 'install') {
      // Show onboarding or welcome page for new installations
      browser.tabs.create({
        url: '/pages/welcome.html'
      });
      
      // Initialize with default settings
      browser.storage.local.set({ settings: defaultSettings });
    } else if (details.reason === 'update') {
      // Potential migration logic for updates
      console.log(`Extension updated from ${details.previousVersion}`);
    }
  });
}

// Initialize the extension when loaded
function init() {
  initializeExtension();
  setupMessageListeners();
  registerEventHandlers();
  console.log('Moodify Vibe Color extension initialized');
}

// Start the extension
init();

