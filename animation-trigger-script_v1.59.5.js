//  - Added data-delay feature to add a delay to trigger events.
//  - Added data-active-space attribute to control active trigger zones.
//  - Added support for complex CSS-like selectors in data-child-target.


// ---------------------------
// Global Debounce Settings
// ---------------------------

/**
* Global settings for the Animation Trigger Script.
* 
* @property {boolean} debounceEnabled - Enables or disables debouncing globally.
* @property {number} debounceWait - Default debounce wait time in milliseconds.
*/
const AnimationTriggerSettings = {
  debounceEnabled: true, // Set to `false` to disable debouncing globally
  debounceWait: 10       // Default debounce wait time in milliseconds
};

/**
* Global method to update debounce settings.
* 
* @param {boolean} enabled - Enable (`true`) or disable (`false`) debouncing globally.
* @param {number} [wait] - Optional custom debounce wait time in milliseconds.
*/
window.setAnimationTriggerDebounce = function(enabled, wait) {
  AnimationTriggerSettings.debounceEnabled = enabled;
  if (typeof wait === 'number') {
    AnimationTriggerSettings.debounceWait = wait;
  }
  console.log(`Global debounce enabled: ${enabled}, wait time: ${AnimationTriggerSettings.debounceWait}ms`);
};

// ---------------------------
// Helper Functions
// ---------------------------

/**
* Parses a time string (e.g., "1s", "500ms") into milliseconds.
* @param {string} timeStr - The time string to parse.
* @returns {number|null} - The time in milliseconds or null if invalid.
*/
function parseTimeValue(timeStr) {
  const match = timeStr.match(/^(\d+\.?\d*)(ms|s)$/i);
  if (!match) {
    console.warn(`Invalid time format: ${timeStr}`);
    return null;
  }
  let value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') value *= 1000;
  return value;
}

/**
* Applies a new state to an element by removing existing states and adding the new one.
* @param {HTMLElement} element - The target DOM element.
* @param {string} newState - The new state class to apply.
* @param {Array<string>} allStates - Array of all possible state classes.
*/
function applyState(element, newState, allStates) {
  allStates.forEach(state => {
    element.classList.remove(state);
  });
  element.classList.add(newState);
  // console.log(`Applied state "${newState}" to`, element);
}

/**
* Adds event listeners to target elements based on selectors.
* Utilizes event delegation for performance optimization.
* @param {string} eventType - The type of event (e.g., 'click').
* @param {Array<string>} selectors - Array of CSS selectors for target elements.
* @param {Function} handler - The event handler function.
*/
function addDelegatedEventListener(eventType, selectors, handler) {
  document.addEventListener(eventType, (event) => {
    selectors.forEach(selector => {
      const targetElement = event.target.closest(selector);
      if (targetElement && document.contains(targetElement)) {
        handler.call(targetElement, event);
      }
    });
  });
  //console.log(`Added delegated "${eventType}" listener for selectors:`, selectors);
}

/**
* Sets up time-based triggers (loop, loop interval, interval, delay).
* 
* - **loop:** Repeats the trigger at a fixed interval indefinitely.
* - **loop interval:** Repeats the trigger following a sequence of intervals indefinitely.
* - **interval:** Executes the trigger following a sequence of intervals only once.
* - **delay:** Executes the trigger once after a specified delay.
* 
* @param {HTMLElement} trigger - The target DOM element.
* @param {string} timeValue - The time configuration string (e.g., "loop:5s", "loop interval:1s,2s,3s").
* @param {Function} handleTrigger - The function to execute on trigger.
*/
function setupTimeTriggers(trigger, timeValue, handleTrigger) {
  // Clear existing timers
  stopTimeTriggers(trigger);
  
  const [type, ...rest] = timeValue.split(':').map(s => s.trim());
  switch (type.toLowerCase()) {
    case 'loop':
      const loopInterval = parseTimeValue(rest[0]);
      if (loopInterval) {
        trigger.timeIntervalID = setInterval(() => handleTrigger(trigger), loopInterval);
        // console.log(`Set loop interval "${loopInterval}ms" for`, trigger);
      }
      break;
    
    case 'loop interval':
      const loopIntervals = rest.flatMap(part => part.split(',').map(s => parseTimeValue(s.trim()))).filter(v => v != null);
      if (loopIntervals.length > 0) {
        let loopIndex = 0;
        
        function runLoopInterval() {
          handleTrigger(trigger);
          loopIndex++;
          
          if (loopIndex < loopIntervals.length) {
            // Schedule the next trigger based on the current interval
            trigger.timeTimeoutID = setTimeout(runLoopInterval, loopIntervals[loopIndex]);
          } else {
            // Reset index and start the loop again
            loopIndex = 0;
            trigger.timeTimeoutID = setTimeout(runLoopInterval, loopIntervals[loopIndex]);
          }
        }
        
        // Delay the first trigger by the first interval duration
        trigger.timeTimeoutID = setTimeout(runLoopInterval, loopIntervals[loopIndex]);
        // console.log(`Set loop intervals "${loopIntervals}ms" for`, trigger);
      }
      break;
    
    case 'interval':
      const intervals = rest.flatMap(part => part.split(',').map(s => parseTimeValue(s.trim()))).filter(v => v != null);
      if (intervals.length > 0) {
        let index = 0;
        
        function runInterval() {
          if (index < intervals.length) {
            handleTrigger(trigger);
            index++;
            if (index < intervals.length) {
              trigger.timeTimeoutID = setTimeout(runInterval, intervals[index]);
            }
          }
        }
        
        // Delay the first trigger by the first interval duration
        trigger.timeTimeoutID = setTimeout(runInterval, intervals[index]);
        index++;
        console.log(`Set intervals "${intervals}ms" for`, trigger);
      }
      break;
    
    case 'delay':
      const delay = parseTimeValue(rest[0]);
      if (delay) {
        trigger.timeTimeoutID = setTimeout(() => handleTrigger(trigger), delay);
        console.log(`Set delay "${delay}ms" for`, trigger);
      }
      break;
    
    default:
      console.warn(`Unknown time trigger type: "${type}"`);
  }
}

/**
* Stops any active time-based triggers on a target element.
* @param {HTMLElement} trigger - The target DOM element.
*/
function stopTimeTriggers(trigger) {
  if (trigger.timeIntervalID) {
    clearInterval(trigger.timeIntervalID);
    trigger.timeIntervalID = null;
    console.log('Cleared loop interval timer for', trigger);
  }
  if (trigger.timeTimeoutID) {
    clearTimeout(trigger.timeTimeoutID);
    trigger.timeTimeoutID = null;
    console.log('Cleared timeout timer for', trigger);
  }
}

/**
* Merges overlapping ranges into single continuous ranges.
* Contiguous ranges (where current.start === last.end) are NOT merged.
* @param {Array<{start: number, end: number}>} ranges - Array of range objects.
* @returns {Array<{start: number, end: number}>} - Merged array of range objects.
*/
function mergeRanges(ranges) {
  if (ranges.length === 0) return [];
  
  // Sort ranges by start value
  ranges.sort((a, b) => a.start - b.start);
  
  const merged = [ranges[0]];
  
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const current = ranges[i];
    
    // Only merge if current.start < last.end (overlapping ranges)
    if (current.start < last.end) {
      last.end = Math.max(last.end, current.end);
      console.log(`Merged range ${JSON.stringify(current)} into ${JSON.stringify(last)}`);
    } else {
      // Non-overlapping range, add to merged
      merged.push(current);
      // console.log(`Added new range ${JSON.stringify(current)} to merged ranges`);
    }
  }
  
  return merged;
}

/**
* Debounces a function, ensuring it's called only after a specified delay.
* @param {Function} func - The function to debounce.
* @param {number} wait - The debounce delay in milliseconds.
* @param {boolean} immediate - If true, trigger on the leading edge.
* @returns {Function} - The debounced function.
*/
function debounce(func, wait = 20, immediate = true) {
  let timeout;
  return function(...args) {
    const context = this;
    const later = function() {
      timeout = null;
      if (!immediate) {
        // Ensure args is defined before applying
        if (args) {
          func.apply(context, args);
        } else {
          console.warn("Arguments are undefined in 'later' function.");
        }
      }
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// ---------------------------
// AnimationTrigger Class
// ---------------------------

/**
* Class representing an animation trigger.
*/
class AnimationTrigger {
  /**
  * Creates an AnimationTrigger instance.
  * @param {HTMLElement} element - The target DOM element with class 'animation-trigger'.
  */
  constructor(element) {
    this.element = element;
    this.initialize();
  }
  
  /**
  * Initializes the AnimationTrigger by parsing configurations and setting up listeners.
  */
  initialize() {
    // Avoid re-initializing
    if (this.element._initialized) return;
    this.element._initialized = true;
    
    // Parse configurations
    this.parseConfigurations();
    
    // Setup ranges if applicable
    if (this.triggerPoints.length > 0 || this.triggerRanges.length > 0) {
      this.defineRanges();
    }
    
    // Setup initial state
    this.setupInitialState();
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  /**
  * Parses all relevant data attributes from the element.
  */
  parseConfigurations() {
    const el = this.element;
    
    // Parse Trigger Selectors
    this.triggerClickSelectors = this.parseSelectorList(el.getAttribute('data-trigger-click'));
    this.triggerHoverSelectors = this.parseSelectorList(el.getAttribute('data-trigger-hover'));
    this.triggerCascadeSelectors = this.parseSelectorList(el.getAttribute('data-trigger-cascade'));
    
    // Parse Time Trigger
    this.triggerTime = el.getAttribute('data-trigger-time'); // e.g., "loop:5s"
    
    // Parse Scroll Trigger Points and Ranges
    this.triggerPoints = this.parseNumberList(el.getAttribute('data-trigger-points')); // e.g., "0.25,0.75"
    this.triggerRanges = this.parseRanges(el.getAttribute('data-trigger-ranges')); // e.g., "0-0.5,0.5-1"
    
    // Parse Advancement Behavior
    this.advancement = el.getAttribute('data-advancement') ||
      ((this.triggerPoints.length > 0 || this.triggerRanges.length > 0) ? 'aligned' : 'advance');
    
    // Parse States
    this.states = this.parseStringList(el.getAttribute('data-states')); // e.g., "state1,state2,state3"
    this.initialState = el.getAttribute('data-initial-state') || this.states[0];
    
    // Determine initialStateIndex
    this.initialStateIndex = this.states.indexOf(this.initialState);
    if (this.initialStateIndex === -1) {
      console.warn(`Initial state "${this.initialState}" not found in states array. Defaulting to the first state.`);
      this.initialState = this.states[0];
      this.initialStateIndex = 0;
    }
    
    // Initialize lastAdvancedStateIndex to initialStateIndex
    this.lastAdvancedStateIndex = this.initialStateIndex;
    
    // Parse Hover Events
    this.hoverEvents = this.parseStringList(el.getAttribute('data-hover-event')); // e.g., "enter, hold"
    if (this.hoverEvents.length === 0) {
      this.hoverEvents = ['enter', 'leave'];
      //console.log(`No data-hover-event set. Defaulting to: ${this.hoverEvents.join(',')}`);
    }
    
    // Parse Viewport Alignment
    this.viewportAlign = el.getAttribute('data-viewport-align') || 'middle'; // "top", "middle", "bottom"
    
    // Parse Scroll Animate Flag
    this.scrollAnimate = el.getAttribute('data-scroll-animate') === 'true';
    
    // Assign all possible unique state classes
    this.allStates = [...new Set(this.states)];
    
    // ---------------------------
    // Parse Debounce Settings
    // ---------------------------
    const debounceAttr = el.getAttribute('data-debounce');
    if (debounceAttr) {
      const [enabledStr, waitStr] = debounceAttr.split(':').map(s => s.trim());
      this.debounceEnabled = (enabledStr.toLowerCase() !== 'false'); // Default to true if not 'false'
      this.debounceWait = parseInt(waitStr, 10) || AnimationTriggerSettings.debounceWait;
    } else {
      // Inherit from global settings
      this.debounceEnabled = AnimationTriggerSettings.debounceEnabled;
      this.debounceWait = AnimationTriggerSettings.debounceWait;
    }
    
    // Setup debounced handleScroll based on debounce settings
    this.handleScroll = this.debounceEnabled ?
      debounce(this.handleScrollFunction.bind(this), this.debounceWait, false) :
      this.handleScrollFunction.bind(this);
    
    // Parse Delay
    const delayAttr = el.getAttribute('data-delay');
    this.triggerDelay = delayAttr ? parseTimeValue(delayAttr) : 0;
    
    // ---------------------------
    // Parse Active Space
    // ---------------------------
    const activeSpaceAttr = el.getAttribute('data-active-space');
    if (activeSpaceAttr === 'full') {
      this.activeSpace = null; // Feature disabled
    } else if (activeSpaceAttr) {
      const parts = activeSpaceAttr.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        this.activeSpace = [parts[0], parts[1]];
      } else {
        console.warn(`Invalid data-active-space: "${activeSpaceAttr}". Using default [-1, 2].`);
        this.activeSpace = [-1, 2];
      }
    } else {
      this.activeSpace = [-1, 2];
    }
    
    // Initialize advancement-reset variables if advancement behavior is 'advance-reset'
    if (this.advancement === 'advance-reset') {
      // Create an array of states excluding the initial state
      this.advanceResetStates = this.states.filter(state => state !== this.initialState);
      this.advanceResetIndex = 0;
      this.isInitialStep = true;
    }
  }
  
  /**
   * Defines scroll-based ranges based on data-trigger-ranges or data-trigger-points.
   */
  defineRanges() {
    let ranges = [];

    // Priority 1: Use data-trigger-ranges if defined
    if (this.triggerRanges.length > 0) {
      ranges = this.triggerRanges.map(range => {
        const { start, end } = range;
        if (typeof start !== 'number' || typeof end !== 'number' || start >= end) {
          console.warn(`Invalid range object: start=${start}, end=${end}`);
          return null;
        }
        return { start, end };
      }).filter(range => range !== null);
    }
    // Priority 2: Dynamically create ranges from data-trigger-points
    else if (this.triggerPoints.length > 0) {
      const sortedPoints = [...this.triggerPoints].sort((a, b) => a - b);

      for (let i = 0; i < sortedPoints.length - 1; i++) {
        const start = sortedPoints[i];
        const end = sortedPoints[i + 1];
        if (start < end) {
          ranges.push({ start, end });
        }
      }
    }

    if (ranges.length === 0) {
      console.warn('No valid ranges could be created from data-trigger-points or data-trigger-ranges.');
    }

    // Merge overlapping or contiguous ranges to ensure consistency
    this.ranges = mergeRanges(ranges);

    // Assign the merged ranges to the element for future reference
    this.element.ranges = this.ranges;
    //console.log('Defined ranges:', this.ranges);
  }
  
  /**
  * Sets up the initial state based on the initialState configuration.
  */
  setupInitialState() {
    applyState(this.element, this.initialState, this.allStates);
    this.currentStateIndex = this.initialStateIndex;
    
    // Initialize advancement-reset variables if applicable
    if (this.advancement === 'advance-reset') {
      this.advanceResetStates = this.states.filter(state => state !== this.initialState);
      this.advanceResetIndex = 0;
      this.isInitialStep = true;
    }
    
    // Initialize other flags if necessary
    // this.element.awaitingReset = false; // This can be removed if not used elsewhere
  }
  
  /**
  * Sets up event listeners for triggers (click, hover, cascade).
  */
  setupEventListeners() {
    // Setup Click Event Delegation
    if (this.triggerClickSelectors.length > 0) {
      addDelegatedEventListener('click', this.triggerClickSelectors, () => this.handleTrigger());
    }
    
    // Setup Hover Event Delegation
    if (this.triggerHoverSelectors.length > 0) {
      // 'mouseover' and 'mouseout' are used for event delegation
      addDelegatedEventListener('mouseover', this.triggerHoverSelectors, (event) => {
        if (this.hoverEvents.includes('enter')) {
          this.handleTrigger();
        }
      });
      addDelegatedEventListener('mouseout', this.triggerHoverSelectors, (event) => {
        if (this.hoverEvents.includes('leave')) {
          this.handleTrigger();
        }
      });
      
      // Handle 'hold' separately since it requires timing
      if (this.hoverEvents.includes('hold') && this.triggerTime) {
        this.triggerHoverSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            el.addEventListener('mouseenter', () => {
              console.log('Hover hold start time triggers for', this.element);
              this.handleTrigger(); // Advance state immediately
              setupTimeTriggers(this.element, this.triggerTime, () => this.handleTrigger());
            });
            el.addEventListener('mouseleave', () => {
              console.log('Hover hold stop time triggers for', this.element);
              stopTimeTriggers(this.element);
            });
          });
        });
      }
    }
    
    // Setup Time-Based Triggers (excluding 'hold' handled above)
    if (this.triggerTime && !this.hoverEvents.includes('hold')) {
      setupTimeTriggers(this.element, this.triggerTime, () => this.handleTrigger());
    }
    
    // Setup Cascade Event Delegation
    if (this.triggerCascadeSelectors.length > 0) {
      addDelegatedEventListener('stateChanged', this.triggerCascadeSelectors, () => this.handleTrigger());
    }
  }
  
  /**
   * Handles state transitions based on the advancement behavior.
   */
  handleTrigger() {
    if (this.triggerDelay > 0) {
      setTimeout(() => this.executeTrigger(), this.triggerDelay);
    } else {
      this.executeTrigger();
    }
  }
  
  /**
   * Executes the trigger action based on the advancement behavior.
   */
  executeTrigger() {
    // Check if the element is within the active space
    if (this.activeSpace !== null) {
      const fraction = this.getElementFraction();
      const [min, max] = this.activeSpace;
      if (fraction < min || fraction > max) {
        // Trigger is not active
        return;
      }
    }

    switch (this.advancement) {
      case 'advance':
        this.advanceState();
        break;
      
      case 'toggle-initial':
        this.toggleState();
        break;
      
      case 'advance-reset':
        this.advanceResetHandleTrigger();
        break;
      
      case 'aligned':
        // For 'aligned', state changes are handled via scroll events only.
        // Do not perform any state change here.
        break;
      
      default:
        console.warn(`Unknown advancement behavior: "${this.advancement}" on`, this.element);
    }
  }
  
  /**
   * Advances to the next state.
   */
  advanceState() {
    this.currentStateIndex = (this.currentStateIndex + 1) % this.states.length;
    applyState(this.element, this.states[this.currentStateIndex], this.allStates);
    this.dispatchStateChangedEvent();
  }
  
  /**
   * Toggles between the initial state and the next state.
   */
  toggleState() {
    this.currentStateIndex = (this.currentStateIndex === this.initialStateIndex) ? 
      (this.currentStateIndex + 1) % this.states.length : 
      this.initialStateIndex;
    applyState(this.element, this.states[this.currentStateIndex], this.allStates);
    this.dispatchStateChangedEvent();
  }
  
  /**
   * Advances to the next state and resets to the initial state on subsequent triggers.
   * Ensures the advancement skips the initial state after a reset.
   */
  advanceResetHandleTrigger() {
    if (this.isInitialStep) {
      // Set to the next state in the array
      const nextState = this.advanceResetStates[this.advanceResetIndex];
      this.currentStateIndex = this.states.indexOf(nextState);
      applyState(this.element, nextState, this.allStates);
      this.dispatchStateChangedEvent();

      // Prepare for next step
      this.advanceResetIndex = (this.advanceResetIndex + 1) % this.advanceResetStates.length;
      this.isInitialStep = false;
    } else {
      // Reset to the initial state
      this.resetToInitialState();
      this.isInitialStep = true;
    }
  }
  
  /**
   * Resets the state to the initial state.
   */
  resetToInitialState() {
    applyState(this.element, this.initialState, this.allStates);
    this.currentStateIndex = this.initialStateIndex;
    this.dispatchStateChangedEvent();
  }
  
  /**
   * Dispatches a custom 'stateChanged' event.
   */
  dispatchStateChangedEvent() {
    this.element.dispatchEvent(new CustomEvent('stateChanged', {
      bubbles: true, // Enable event bubbling
      detail: {
        newState: this.states[this.currentStateIndex],
        currentStateIndex: this.currentStateIndex
      }
    }));
  }
  
  /**
   * Calculates the element's position relative to the viewport based on viewport alignment.
   * @returns {number} - The element's reference point as a fraction of the viewport height.
   */
  getElementFraction() {
    const rect = this.element.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    let referencePoint;
    
    switch (this.viewportAlign) {
      case 'top':
        referencePoint = rect.top;
        break;
      case 'bottom':
        referencePoint = rect.bottom;
        break;
      case 'middle':
      default:
        referencePoint = rect.top + rect.height / 2;
        break;
    }
    
    return referencePoint / windowHeight;
  }
  
  /**
   * Handles scroll-based animations and state changes.
   */
  handleScrollFunction() {
    // Ensure this.ranges is defined and has at least one range
    if (!this.ranges || this.ranges.length === 0) {
      return; // Exit early if no scroll-based triggers are defined
    }

    const elementFraction = this.getElementFraction();
    let currentRangeIndex = -1;

    // Define a small epsilon to account for floating point precision
    const epsilon = 0.001;

    // Determine the current range index where elementFraction falls
    for (let i = 0; i < this.ranges.length; i++) {
      const range = this.ranges[i];
      // Inclusive start, exclusive end to prevent overlap
      if (
        (elementFraction > range.start || Math.abs(elementFraction - range.start) < epsilon) &&
        (elementFraction < range.end || (i === this.ranges.length - 1 && Math.abs(elementFraction - range.end) < epsilon))
      ) {
        currentRangeIndex = i;
        break;
      }
    }

    // Update state class based on advancement behavior
    switch (this.advancement) {
      case 'aligned':
        // Determine the number of ranges
        const numRanges = this.ranges.length;
      
        if (numRanges > 1) {
          // Multiple ranges: Truncate states to match the number of ranges
          this.states = this.states.slice(0, numRanges);
      
          const elementFraction = this.getElementFraction();
          const firstRangeStart = this.ranges[0]?.start || 0;
          const lastRangeEnd = this.ranges[numRanges - 1]?.end || 1;
      
          if (elementFraction < firstRangeStart) {
            // Before the first range, set to the first state
            if (this.currentStateIndex !== 0) {
                applyState(this.element, this.states[0], this.allStates);
                this.currentStateIndex = 0;
                this.dispatchStateChangedEvent();
            }
          } else if (elementFraction >= lastRangeEnd) {
            // After the last range, set to the last state
            if (this.currentStateIndex !== numRanges - 1) {
                applyState(this.element, this.states[numRanges - 1], this.allStates);
                this.currentStateIndex = numRanges - 1;
                this.dispatchStateChangedEvent();
            }
          } else {
            // Within the ranges, set to the corresponding state
            for (let i = 0; i < numRanges; i++) {
                if (elementFraction >= this.ranges[i].start && elementFraction < this.ranges[i].end) {
                    if (this.currentStateIndex !== i) {
                        applyState(this.element, this.states[i], this.allStates);
                        this.currentStateIndex = i;
                        this.dispatchStateChangedEvent();
                    }
                    break;
                }
            }
          }
        } else if (numRanges === 1) {
          // One range: Truncate states to match the number of ranges + 1
          this.states = this.states.slice(0, 2);
      
          const elementFraction = this.getElementFraction();
          const rangeStart = this.ranges[0].start;
          const rangeEnd = this.ranges[0].end;
      
          if (elementFraction < rangeStart) {
            // Before the range, set to the first state
            if (this.currentStateIndex !== 0) {
                applyState(this.element, this.states[0], this.allStates);
                this.currentStateIndex = 0;
                this.dispatchStateChangedEvent();
            }
          } else {
            // Within or after the range, set to the second state
            if (this.currentStateIndex !== 1) {
                applyState(this.element, this.states[1], this.allStates);
                this.currentStateIndex = 1;
                this.dispatchStateChangedEvent();
            }
          }
        }
      
        this.dispatchStateChangedEvent();
        break;

      case 'advance':
        if (this.lastRangeIndex !== currentRangeIndex) {
          this.advanceState();
          this.lastRangeIndex = currentRangeIndex;
        }
        break;
      case 'advance-reset':
        if (this.lastRangeIndex !== currentRangeIndex) {
          this.advanceResetHandleTrigger();
          this.lastRangeIndex = currentRangeIndex;
        }
        break;
      case 'toggle-initial':
        if (this.lastRangeIndex !== currentRangeIndex) {
          this.toggleState();
          this.lastRangeIndex = currentRangeIndex;
        }
        break;
      default:
        console.warn(`Unknown advancement behavior: "${this.advancement}" on`, this.element);
    }

    // Only update the --scroll-progress CSS variable if data-scroll-animate is true
    if (this.scrollAnimate) {
      if (currentRangeIndex === -1) {
        if (this.ranges.length > 0) {
          const firstRange = this.ranges[0];
          const lastRange = this.ranges[this.ranges.length - 1];

          if (elementFraction < (firstRange.start - epsilon)) {
            this.element.style.setProperty('--scroll-progress', '0');
          } else if (elementFraction > (lastRange.end + epsilon)) {
            this.element.style.setProperty('--scroll-progress', '1');
          } else {
            this.element.style.setProperty('--scroll-progress', '0');
          }
        }
        return;
      }

      const range = this.ranges[currentRangeIndex];
      let progress = (elementFraction - range.start) / (range.end - range.start);
      progress = Math.min(Math.max(progress, 0), 1);
      progress = Math.round(progress * 100) / 100;
      this.element.style.setProperty('--scroll-progress', progress);
    }
  }
  
  // ---------------------------
  // Helper Methods
  // ---------------------------
  
  /**
   * Parses a comma-separated list of selectors.
   * @param {string|null} attr - The attribute string.
   * @returns {Array<string>} - Array of selectors.
   */
  parseSelectorList(attr) {
    return attr ? attr.split(',').map(s => s.trim()).filter(s => s !== '') : [];
  }
  
  /**
   * Parses a comma-separated list of numbers, allowing negative and greater-than-one values.
   * @param {string|null} attr - The attribute string.
   * @returns {Array<number>} - Array of numbers.
   */
  parseNumberList(attr) {
    return attr ? attr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)) : [];
  }
  
  /**
   * Parses a comma-separated list of strings.
   * @param {string|null} attr - The attribute string.
   * @returns {Array<string>} - Array of strings.
   */
  parseStringList(attr) {
    return attr ? attr.split(',').map(s => s.trim()).filter(s => s !== '') : [];
  }
  
  /**
   * Parses ranges from a comma-separated string, allowing negative and greater-than-one values.
   * @param {string|null} attr - The attribute string.
   * @returns {Array<{start: number, end: number}>} - Array of range objects.
   */
  parseRanges(attr) {
    if (!attr) return [];
    return attr.split(',').map(rangeStr => {
      // Use a regular expression to correctly split the range string
      const match = rangeStr.match(/^(-?\d*\.?\d+)-(-?\d*\.?\d+)$/);
      if (!match) {
        console.warn(`Invalid range: "${rangeStr}"`);
        return null;
      }
      const start = parseFloat(match[1]);
      const end = parseFloat(match[2]);
      return { start, end };
    }).filter(r => r !== null);
  }
}

// ---------------------------
// Main Animation Trigger Initialization
// ---------------------------

/**
 * Applies the 'animation-trigger' class and copies all relevant data attributes
 * from the parent to the target elements specified in data-child-target.
 * 
 * Supports complex CSS selectors like ':nth-child' and direct child selectors ('>').
 * 
 * @param {HTMLElement} parentElement - The parent element with 'animation-trigger-parent' class.
 * @returns {AnimationTrigger[]} - Array of initialized AnimationTrigger instances for targets.
 */
function handleParentChildTriggers(parentElement) {
  const triggerInstances = [];
  const childTargetSelectors = parentElement.getAttribute('data-child-target');

  if (childTargetSelectors) {
    try {
      // Split selectors by comma and trim whitespace
      const selectors = childTargetSelectors
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '');

      selectors.forEach(selector => {
        // Use the entire document scope to allow selecting any element based on the selector
        const targetElements = document.querySelectorAll(selector);

        if (targetElements.length === 0) {
          console.warn(`No elements found for selector "${selector}" in data-child-target.`);
        }

        targetElements.forEach(child => {
          // Skip if child already has 'animation-trigger' class (manual configuration)
          if (!child.classList.contains('animation-trigger')) {
            // Add 'animation-trigger' class to child
            child.classList.add('animation-trigger');

            // Copy all relevant data attributes from parent to child
            Array.from(parentElement.attributes)
              .filter(attr => attr.name.startsWith('data-') && attr.name !== 'data-child-target')
              .forEach(attr => {
                child.setAttribute(attr.name, attr.value);
              });

            // Initialize AnimationTrigger for the child
            const childInstance = new AnimationTrigger(child);
            triggerInstances.push(childInstance);
            //console.log(`Applied parent 'animation-trigger' to target element:`, child);
          } else {
            //console.log(`Skipped applying parent config to manually configured 'animation-trigger':`, child);
          }
        });
      });
    } catch (error) {
      console.error(`Error processing data-child-target selectors:`, error);
    }
  } else {
    console.warn(`Parent element with 'animation-trigger-parent' class is missing 'data-child-target' attribute.`);
  }

  return triggerInstances;
}

(function() {
  // Array to hold all AnimationTrigger instances
  const triggerInstances = [];

  /**
   * Function to initialize all animation triggers.
   */
  function initializeAnimationTriggers() {
    // Handle parent elements first to apply configurations to target elements
    const parentTriggers = document.querySelectorAll('.animation-trigger-parent');

    parentTriggers.forEach(parentElement => {
      const parentChildInstances = handleParentChildTriggers(parentElement);
      triggerInstances.push(...parentChildInstances);

      // Initialize the parent as an AnimationTrigger if it also has the 'animation-trigger' class
      if (parentElement.classList.contains('animation-trigger')) {
        const parentInstance = new AnimationTrigger(parentElement);
        triggerInstances.push(parentInstance);
        // console.log(`Initialized parent '.animation-trigger':`, parentElement);
      }
    });

    // Initialize all direct animation triggers excluding those handled by parents
    const directTriggers = document.querySelectorAll('.animation-trigger');

    directTriggers.forEach(triggerElement => {
      const isHandledByParent = triggerElement.classList.contains('animation-trigger-parent');

      // Skip initializing if the element is a parent and already initialized
      if (!isHandledByParent) {
        const instance = new AnimationTrigger(triggerElement);
        triggerInstances.push(instance);
        // console.log(`Initialized direct '.animation-trigger':`, triggerElement);
      }
    });

    return triggerInstances;
  }

  // Initialize animation triggers on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    const instances = initializeAnimationTriggers();

    /**
     * Handles scroll and resize events by updating states based on scroll position.
     */
    function handleScrollEvents() {
      instances.forEach(trigger => {
        if (typeof trigger.handleScroll === 'function') {
          trigger.handleScroll();
        } else {
          // console.warn('handleScroll is not a function for trigger:', trigger.element);
        }
      });
    }

    // Attach scroll and resize listeners
    window.addEventListener('scroll', handleScrollEvents);
    window.addEventListener('resize', handleScrollEvents);

    // Initial call to set states based on initial scroll position
    handleScrollEvents();
  });
})();
