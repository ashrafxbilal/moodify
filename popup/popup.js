document.addEventListener('DOMContentLoaded', function() {
    // Get all UI elements
    const enableToggle = document.getElementById('enableToggle');
    const systemThemeToggle = document.getElementById('systemThemeToggle');
    const moodOptions = document.querySelectorAll('.mood-option');
    const saturationSlider = document.getElementById('saturationSlider');
    const brightnessSlider = document.getElementById('brightnessSlider');
    const saturationValue = document.getElementById('saturationValue');
    const brightnessValue = document.getElementById('brightnessValue');
    const imagesToggle = document.getElementById('imagesToggle');
    const readabilityToggle = document.getElementById('readabilityToggle');
    const applyButton = document.getElementById('applyButton');
    const resetButton = document.getElementById('resetButton');
    
    // New UI elements
    const siteSpecificToggle = document.getElementById('siteSpecificToggle');
    const currentSiteElement = document.getElementById('currentSite');
    const saveSiteSettingsBtn = document.getElementById('saveSiteSettingsBtn');
    const timeBasedToggle = document.getElementById('timeBasedToggle');
    const timeBasedControls = document.getElementById('timeBasedControls');
    const dayMoodSelect = document.getElementById('dayMoodSelect');
    const nightMoodSelect = document.getElementById('nightMoodSelect');
    const customColorsToggle = document.getElementById('customColorsToggle');
    const colorCustomizationControls = document.getElementById('colorCustomizationControls');
    const bgColorPicker = document.getElementById('bgColorPicker');
    const textColorPicker = document.getElementById('textColorPicker');
    const linkColorPicker = document.getElementById('linkColorPicker');
    
    // Extension settings object
    let settings = {
        enabled: true,
        mood: 'focused',
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
        }
    };
    
    // Current site information
    let currentSite = '';
    
    // Initialize UI from saved settings
    function initializeUI() {
        // Get saved settings from storage
        browser.storage.local.get('moodifySettings').then((result) => {
            if (result.moodifySettings) {
                settings = result.moodifySettings;
                
                // Apply saved settings to UI
                enableToggle.checked = settings.enabled;
                saturationSlider.value = settings.saturation;
                saturationValue.textContent = `${settings.saturation}%`;
                brightnessSlider.value = settings.brightness;
                brightnessValue.textContent = `${settings.brightness}%`;
                imagesToggle.checked = settings.applyToImages;
                readabilityToggle.checked = settings.textReadability;
                
                // Initialize new UI elements if they exist
                if (systemThemeToggle) {
                    systemThemeToggle.checked = settings.followSystemTheme || false;
                }
                
                if (siteSpecificToggle) {
                    siteSpecificToggle.checked = settings.siteSpecific?.enabled || false;
                    if (siteSpecificControls) {
                        siteSpecificControls.style.display = settings.siteSpecific?.enabled ? 'block' : 'none';
                    }
                }
                
                if (timeBasedToggle) {
                    timeBasedToggle.checked = settings.timeBased?.enabled || false;
                    if (timeBasedControls) {
                        timeBasedControls.style.display = settings.timeBased?.enabled ? 'block' : 'none';
                    }
                    if (dayMoodSelect) {
                        dayMoodSelect.value = settings.timeBased?.dayMood || 'focused';
                    }
                    if (nightMoodSelect) {
                        nightMoodSelect.value = settings.timeBased?.nightMood || 'calm';
                    }
                }
                
                if (customColorsToggle) {
                    customColorsToggle.checked = settings.customColors?.enabled || false;
                    if (colorCustomizationControls) {
                        colorCustomizationControls.style.display = settings.customColors?.enabled ? 'block' : 'none';
                    }
                    if (bgColorPicker) {
                        bgColorPicker.value = settings.customColors?.backgroundColor || '#ffffff';
                    }
                    if (textColorPicker) {
                        textColorPicker.value = settings.customColors?.textColor || '#000000';
                    }
                    if (linkColorPicker) {
                        linkColorPicker.value = settings.customColors?.linkColor || '#0066cc';
                    }
                }
                
                // Select the saved mood
                moodOptions.forEach(option => {
                    option.classList.remove('selected');
                    if (option.dataset.mood === settings.mood) {
                        option.classList.add('selected');
                    }
                });
                
                // Update UI state based on enabled status
                updateUIState();
                
                // Get current site information for site-specific settings
                getCurrentSite();
            }
        });
    }
    
    // Get the current site information
    function getCurrentSite() {
        browser.tabs.query({active: true, currentWindow: true})
            .then((tabs) => {
                if (tabs[0] && tabs[0].url) {
                    try {
                        const url = new URL(tabs[0].url);
                        currentSite = url.hostname;
                        
                        // Update UI with current site
                        if (currentSiteElement) {
                            currentSiteElement.textContent = currentSite;
                        }
                        
                        // Apply site-specific settings if available
                        if (settings.siteSpecific?.enabled && 
                            settings.siteSpecific.sites && 
                            settings.siteSpecific.sites[currentSite]) {
                            
                            const siteSettings = settings.siteSpecific.sites[currentSite];
                            
                            // Apply site-specific mood
                            if (siteSettings.mood) {
                                settings.mood = siteSettings.mood;
                                moodOptions.forEach(option => {
                                    option.classList.remove('selected');
                                    if (option.dataset.mood === settings.mood) {
                                        option.classList.add('selected');
                                    }
                                });
                            }
                            
                            // Apply other site-specific settings
                            if (siteSettings.saturation !== undefined) {
                                settings.saturation = siteSettings.saturation;
                                saturationSlider.value = settings.saturation;
                                saturationValue.textContent = `${settings.saturation}%`;
                            }
                            
                            if (siteSettings.brightness !== undefined) {
                                settings.brightness = siteSettings.brightness;
                                brightnessSlider.value = settings.brightness;
                                brightnessValue.textContent = `${settings.brightness}%`;
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing URL:', e);
                    }
                }
            });
    }
    
    // Update UI elements based on whether extension is enabled
    function updateUIState() {
        const uiElements = [
            ...moodOptions, 
            saturationSlider, 
            brightnessSlider, 
            imagesToggle, 
            readabilityToggle
        ];
        
        if (settings.enabled) {
            uiElements.forEach(el => el.removeAttribute('disabled'));
            document.body.style.opacity = '1';
        } else {
            uiElements.forEach(el => el.setAttribute('disabled', 'true'));
            document.body.style.opacity = '0.7';
        }
    }
    
    // Save settings to storage
    function saveSettings() {
        browser.storage.local.set({
            moodifySettings: settings
        }).then(() => {
            console.log('Settings saved');
        });
    }
    
    // Apply current settings to the current tab
    function applySettings() {
        browser.tabs.query({active: true, currentWindow: true})
            .then((tabs) => {
                browser.tabs.sendMessage(tabs[0].id, {
                    action: 'applyMood',
                    settings: settings
                });
            })
            .catch(error => {
                console.error('Error applying settings:', error);
            });
    }
    
    // Event Listeners for UI elements
    
    // Enable toggle - now the main control for applying/disabling color modifications
    enableToggle.addEventListener('change', function() {
        settings.enabled = this.checked;
        updateUIState();
        saveSettings();
        applySettings();
        
        // Show brief visual feedback
        const toggleContainer = this.closest('.toggle-container');
        if (toggleContainer) {
            const span = toggleContainer.querySelector('span');
            if (span) {
                const originalText = span.textContent;
                span.textContent = settings.enabled ? 'Enabled!' : 'Disabled!';
                setTimeout(() => {
                    span.textContent = originalText;
                }, 1000);
            }
        }
    });


    
    // Mood selection
    moodOptions.forEach(option => {
        option.addEventListener('click', function() {
            if (!settings.enabled) return;
            
            // Remove selected class from all options
            moodOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Add selected class to clicked option
            this.classList.add('selected');
            
            // Update settings
            settings.mood = this.dataset.mood;
            
            // Apply mood-specific color to sliders
            updateSliderColors(this.dataset.mood);
            
            // Automatically save and apply settings
            saveSettings();
            applySettings();
        });
    });
    
    // Update slider colors based on mood
    function updateSliderColors(mood) {
        let color;
        switch (mood) {
            case 'calm': color = '#00838f'; break;
            case 'happy': color = '#fbc02d'; break;
            case 'energetic': color = '#e64a19'; break;
            case 'focused': color = '#3949ab'; break;
            case 'relaxed': color = '#388e3c'; break;
            case 'creative': color = '#8e24aa'; break;
            default: color = '#4285f4';
        }
        
        // Update slider thumb color
        const sliders = document.querySelectorAll('.slider');
        sliders.forEach(slider => {
            slider.style.setProperty('--thumb-color', color);
        });
    }
    
    // Saturation slider
    saturationSlider.addEventListener('input', function() {
        if (!settings.enabled) return;
        
        settings.saturation = this.value;
        saturationValue.textContent = `${this.value}%`;
    });
    
    saturationSlider.addEventListener('change', function() {
        if (!settings.enabled) return;
        
        // Automatically save and apply settings when slider is released
        saveSettings();
        applySettings();
    });
    
    // Brightness slider
    brightnessSlider.addEventListener('input', function() {
        if (!settings.enabled) return;
        
        settings.brightness = this.value;
        brightnessValue.textContent = `${this.value}%`;
    });
    
    brightnessSlider.addEventListener('change', function() {
        if (!settings.enabled) return;
        
        // Automatically save and apply settings when slider is released
        saveSettings();
        applySettings();
    });
    
    // Images toggle
    imagesToggle.addEventListener('change', function() {
        if (!settings.enabled) return;
        
        settings.applyToImages = this.checked;
    });
    
    // Readability toggle
    readabilityToggle.addEventListener('change', function() {
        if (!settings.enabled) return;
        
        settings.textReadability = this.checked;
    });
    
    // Apply and Reset button functionality removed
    // Enable toggle now handles applying settings
    
    // System Theme Toggle
    if (systemThemeToggle) {
        systemThemeToggle.addEventListener('change', function() {
            settings.followSystemTheme = this.checked;
            saveSettings();
            applySettings();
        });
    }
    
    // Site-specific Settings Toggle
    if (siteSpecificToggle) {
        siteSpecificToggle.addEventListener('change', function() {
            settings.siteSpecific.enabled = this.checked;
            if (siteSpecificControls) {
                siteSpecificControls.style.display = this.checked ? 'block' : 'none';
            }
            saveSettings();
            applySettings();
        });
    }
    
    // Save Site Settings Button
    if (saveSiteSettingsBtn) {
        saveSiteSettingsBtn.addEventListener('click', function() {
            if (!currentSite) return;
            
            // Create or update site-specific settings
            if (!settings.siteSpecific.sites) {
                settings.siteSpecific.sites = {};
            }
            
            settings.siteSpecific.sites[currentSite] = {
                mood: settings.mood,
                saturation: parseInt(settings.saturation),
                brightness: parseInt(settings.brightness)
            };
            
            saveSettings();
            
            // Show brief confirmation
            this.textContent = 'Saved!';
            setTimeout(() => {
                this.textContent = 'Save for this site';
            }, 1000);
        });
    }
    
    // Time-based Automation Toggle
    if (timeBasedToggle) {
        timeBasedToggle.addEventListener('change', function() {
            settings.timeBased.enabled = this.checked;
            if (timeBasedControls) {
                timeBasedControls.style.display = this.checked ? 'block' : 'none';
            }
            saveSettings();
            applySettings();
        });
    }
    
    // Day Mood Select
    if (dayMoodSelect) {
        dayMoodSelect.addEventListener('change', function() {
            settings.timeBased.dayMood = this.value;
            saveSettings();
            applySettings();
        });
    }
    
    // Night Mood Select
    if (nightMoodSelect) {
        nightMoodSelect.addEventListener('change', function() {
            settings.timeBased.nightMood = this.value;
            saveSettings();
            applySettings();
        });
    }
    
    // Custom Colors Toggle
    if (customColorsToggle) {
        customColorsToggle.addEventListener('change', function() {
            settings.customColors.enabled = this.checked;
            if (colorCustomizationControls) {
                colorCustomizationControls.style.display = this.checked ? 'block' : 'none';
            }
            saveSettings();
            applySettings();
        });
    }
    
    // Color Pickers
    if (bgColorPicker) {
        bgColorPicker.addEventListener('change', function() {
            settings.customColors.backgroundColor = this.value;
            saveSettings();
            applySettings();
        });
    }
    
    if (textColorPicker) {
        textColorPicker.addEventListener('change', function() {
            settings.customColors.textColor = this.value;
            saveSettings();
            applySettings();
        });
    }
    
    if (linkColorPicker) {
        linkColorPicker.addEventListener('change', function() {
            settings.customColors.linkColor = this.value;
            saveSettings();
            applySettings();
        });
    }
    
    // Initialize the UI when the popup is opened
    initializeUI();
});
