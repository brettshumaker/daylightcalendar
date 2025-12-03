document.addEventListener('DOMContentLoaded', function() {
  // Connect to socket.io server
  const socket = io();
  
  // Configuration
  let appConfig = {
    theme: 'light',
    show_weather: true,
    locale: 'en-US',
    time_format: '12h'
  };
  
  // Handle sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-logo');
  const app = document.getElementById('app');
  
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function() {
      app.classList.toggle('sidebar-collapsed');
      
      // Re-render calendar after sidebar animation completes
      setTimeout(() => {
        renderCalendarGrid();
      }, 300); // Match transition-speed CSS variable
    });
  }

  // Modal management
  const openModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
    }
  };

  const closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
    }
  };

  // Set up modal close buttons
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      modal.classList.remove('show');
      
      // If this is the game modal, clear the iframe src when closing
      if (modal.id === 'game-focus-modal') {
        document.getElementById('game-iframe').src = '';
      }
    });
  });

  // Add chore button
  const addChoreButton = document.getElementById('add-chore-button');
  if (addChoreButton) {
    addChoreButton.addEventListener('click', () => {
      openModal('add-chore-modal');
    });
  }

  // Meal categories button
  const mealCategoriesButton = document.getElementById('meal-categories-button');
  if (mealCategoriesButton) {
    mealCategoriesButton.addEventListener('click', () => {
      openModal('meal-categories-modal');
    });
  }

  // Add meal button event listener
  const addMealButton = document.getElementById('add-meal-button');
  if (addMealButton) {
    addMealButton.addEventListener('click', () => {
      // Populate the meal type dropdown before opening modal
      populateMealTypeDropdown();
      openModal('add-meal-modal');
    });
  }

  // Function to populate meal type dropdown
  async function populateMealTypeDropdown() {
    const mealTypeSelect = document.getElementById('mealType');
    if (!mealTypeSelect) return;
    
    try {
      // Clear existing options
      mealTypeSelect.innerHTML = '';
      
      // Fetch categories from API
      const response = await fetch('/api/meal-categories');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const categories = await response.json();
      
      // Add options for each category
      if (Array.isArray(categories)) {
        categories.forEach(category => {
          const option = document.createElement('option');
          option.value = category.name.toLowerCase();
          option.textContent = category.name;
          mealTypeSelect.appendChild(option);
        });
      }
      
      // Set a default selection if available
      if (mealTypeSelect.options.length > 0) {
        mealTypeSelect.selectedIndex = 0;
      }
    } catch (error) {
      console.error('Error populating meal types:', error);
      // Add default meal types as fallback
      ['Breakfast', 'Lunch', 'Dinner'].forEach(type => {
        const option = document.createElement('option');
        option.value = type.toLowerCase();
        option.textContent = type;
        mealTypeSelect.appendChild(option);
      });
    }
  }

  // Toggle completed chores button
  const toggleCompletedButton = document.getElementById('toggle-completed');
  let hideCompleted = false;
  if (toggleCompletedButton) {
    toggleCompletedButton.addEventListener('click', () => {
      hideCompleted = !hideCompleted;
      const icon = toggleCompletedButton.querySelector('i');
      
      if (hideCompleted) {
        toggleCompletedButton.innerHTML = '<i class="fas fa-eye"></i> Show Completed';
        document.querySelectorAll('.kanban-item.completed').forEach(item => {
          item.style.display = 'none';
        });
      } else {
        toggleCompletedButton.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Completed';
        document.querySelectorAll('.kanban-item.completed').forEach(item => {
          item.style.display = 'block';
        });
      }
    });
  }

  // Jump to today button
  const jumpToTodayButton = document.getElementById('jump-to-today');
  if (jumpToTodayButton) {
    jumpToTodayButton.addEventListener('click', () => {
      // This would depend on how we represent dates in the UI
      // For now, we'll just log it
      console.log('Jump to today clicked');
      // We'd need to highlight today's items or scroll to them
    });
  }

  // Meal week navigation
  let currentWeekStart = moment().startOf('week');
  
  const updateMealWeekDates = () => {
    const dayHeaders = document.querySelectorAll('.day-header');
    dayHeaders.forEach((header, index) => {
      const date = moment(currentWeekStart).add(index, 'days');
      header.textContent = date.format('ddd, MMM D');
      
      if (date.isSame(moment(), 'day')) {
        header.classList.add('today');
      } else {
        header.classList.remove('today');
      }
    });
    
    // Mark today's cells
    document.querySelectorAll('.meal-cell').forEach(cell => {
      const dayIndex = parseInt(cell.dataset.day);
      const date = moment(currentWeekStart).add(dayIndex, 'days');
      
      if (date.isSame(moment(), 'day')) {
        cell.classList.add('today');
      } else {
        cell.classList.remove('today');
      }
    });
    
    // Refresh meal data for the current week
    fetchAndDisplayMeals();
  };
  
  const prevWeekButton = document.getElementById('prev-week');
  if (prevWeekButton) {
    prevWeekButton.addEventListener('click', () => {
      currentWeekStart = moment(currentWeekStart).subtract(1, 'week');
      updateMealWeekDates();
    });
  }
  
  const nextWeekButton = document.getElementById('next-week');
  if (nextWeekButton) {
    nextWeekButton.addEventListener('click', () => {
      currentWeekStart = moment(currentWeekStart).add(1, 'week');
      updateMealWeekDates();
    });
  }
  
  // Fetch configuration
  fetch('/api/config')
    .then(response => response.json())
    .then(config => {
      appConfig = config;
      updateTheme(appConfig.theme);
      updateTime();
      if (appConfig.show_weather) {
        fetchWeather();
      } else {
        document.getElementById('weather-container').style.display = 'none';
      }
    })
    .catch(error => {
      console.error('Error loading configuration:', error);
    });
  
  // Custom Calendar System
  let currentView = localStorage.getItem('calendar-view') || 'week';
  let allCalendarEvents = [];
  let forecastData = [];
  
  // Weather icon mapping
  const weatherIconMap = {
    'clear-night': 'fa-moon',
    'cloudy': 'fa-cloud',
    'fog': 'fa-smog',
    'partlycloudy': 'fa-cloud-sun',
    'pouring': 'fa-cloud-showers-heavy',
    'rainy': 'fa-cloud-rain',
    'snowy': 'fa-snowflake',
    'sunny': 'fa-sun',
    'windy': 'fa-wind'
  };
  
  // Initialize view selector buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    // Set active state based on currentView
    if (btn.dataset.view === currentView) {
      btn.classList.add('active');
    }
    
    btn.addEventListener('click', () => {
      // Update active state
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update view and persist
      currentView = btn.dataset.view;
      localStorage.setItem('calendar-view', currentView);
      
      // Re-render calendar
      renderCalendarGrid();
    });
  });
  
  // Fetch calendar events for users with assigned calendars
  async function fetchCalendarEvents() {
    try {
      // First, get all users to find calendar assignments
      const usersResponse = await fetch('/api/users');
      const users = await usersResponse.json();
      
      // Get users with assigned calendars
      const usersWithCalendars = users.filter(u => u.calendarEntity);
      
      if (usersWithCalendars.length === 0) {
        console.log('No users with assigned calendars');
        allCalendarEvents = [];
        renderCalendarGrid();
        return;
      }
      
      // Fetch all calendars from HA
      const calendarsResponse = await fetch('/api/calendar');
      const calendars = await calendarsResponse.json();
      
      // Map events to users and apply user colors
      allCalendarEvents = [];
      
        if (Array.isArray(calendars)) {
          calendars.forEach(cal => {
          // Find user assigned to this calendar
          const assignedUser = usersWithCalendars.find(u => u.calendarEntity === cal.entity_id);
          
          if (assignedUser && cal.events) {
            // Add events with user's color
            cal.events.forEach(event => {
              allCalendarEvents.push({
                title: event.summary,
                start: event.start.dateTime || event.start.date,
                end: event.end.dateTime || event.end.date,
                allDay: !event.start.dateTime,
                location: event.location,
                description: event.description,
                userId: assignedUser.id,
                userName: assignedUser.name,
                userColor: assignedUser.color,
                calendarEntity: cal.entity_id
              });
            });
            }
          });
        }
        
      // Render the calendar grid
      renderCalendarGrid();
        
        // Update next event
      updateNextEvent(allCalendarEvents);
    } catch (error) {
        console.error('Error fetching calendar events:', error);
    }
  }
  
  // Render custom calendar grid
  function renderCalendarGrid() {
    const container = document.getElementById('custom-calendar-grid');
    if (!container) return;
    
    // Calculate days to show based on current view
    const daysToShow = {
      'today': 1,
      'tomorrow': 2,
      'week': 7,
      'twoweeks': 14,
      'month': 28
    }[currentView] || 7;
    
    // Generate array of dates starting from today
    const days = [];
    for (let i = 0; i < daysToShow; i++) {
      days.push(moment().add(i, 'days'));
    }
    
    // Create grid
    const grid = document.createElement('div');
    grid.className = `calendar-grid view-${currentView}`;
    
    days.forEach((day, index) => {
      const dayCol = document.createElement('div');
      dayCol.className = 'day-column';
      dayCol.dataset.date = day.format('YYYY-MM-DD');
      
      // Mark today
      if (day.isSame(moment(), 'day')) {
        dayCol.classList.add('today');
      }
      
      // Day header
      const header = document.createElement('div');
      header.className = 'day-header';
      
      const dayNumber = document.createElement('div');
      dayNumber.className = 'day-number';
      dayNumber.textContent = day.format('D');
      
      const dayName = document.createElement('div');
      dayName.className = 'day-name';
      dayName.textContent = day.format('dddd');
      
      const dayDate = document.createElement('div');
      dayDate.className = 'day-date';
      dayDate.textContent = day.format('MMMM YYYY');
      
      header.appendChild(dayNumber);
      header.appendChild(dayName);
      header.appendChild(dayDate);
      
      // Weather for the day (from forecast)
      const dayWeather = document.createElement('div');
      dayWeather.className = 'day-weather';
      
      const forecastForDay = forecastData.find(f => 
        moment(f.datetime).isSame(day, 'day')
      );
      
      if (forecastForDay) {
        const weatherIcon = document.createElement('div');
        weatherIcon.className = 'day-weather-icon';
        const iconClass = weatherIconMap[forecastForDay.condition] || 'fa-cloud';
        weatherIcon.innerHTML = `<i class="fas ${iconClass}"></i>`;
        
        const weatherTemp = document.createElement('div');
        weatherTemp.className = 'day-weather-temp';
        const high = forecastForDay.temperature ? Math.round(forecastForDay.temperature) : '--';
        const low = forecastForDay.templow ? Math.round(forecastForDay.templow) : '--';
        weatherTemp.textContent = `${high}° / ${low}°`;
        
        dayWeather.appendChild(weatherIcon);
        dayWeather.appendChild(weatherTemp);
      }
      
      // Events for the day
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'day-events';
      
      // Filter events for this day (including multi-day events that span this day)
      const eventsForDay = allCalendarEvents.filter(event => {
        const eventStart = moment(event.start);
        const eventEnd = moment(event.end || event.start);
        
        // Check if this day falls within the event's date range
        return day.isBetween(eventStart, eventEnd, 'day', '[]'); // inclusive on both ends
      });
      
      if (eventsForDay.length === 0) {
        eventsContainer.classList.add('no-events');
        eventsContainer.textContent = 'No events';
      } else {
        // Sort events by start time
        eventsForDay.sort((a, b) => moment(a.start).diff(moment(b.start)));
        
        // Deduplicate events (in case same event appears multiple times)
        const seenEvents = new Set();
        const uniqueEvents = eventsForDay.filter(event => {
          const eventKey = `${event.userId}-${event.title}-${event.start}`;
          if (seenEvents.has(eventKey)) {
            return false;
          }
          seenEvents.add(eventKey);
          return true;
        });
        
        uniqueEvents.forEach(event => {
          const eventEl = document.createElement('div');
          eventEl.className = 'calendar-event';
          eventEl.style.backgroundColor = event.userColor;
          eventEl.dataset.userId = event.userId;
          eventEl.dataset.calendarEntity = event.calendarEntity;
          
          // Check if event is in the past
          if (moment(event.end || event.start).isBefore(moment())) {
            eventEl.classList.add('past');
          }
          
          // Add all-day class if needed
          if (event.allDay) {
            eventEl.classList.add('all-day');
          }
          
          // Event time/duration display
          const timeEl = document.createElement('div');
          timeEl.className = 'event-time';
          
          if (!event.allDay) {
            const startTime = moment(event.start).format('HH:mm');
            const endTime = event.end ? ` - ${moment(event.end).format('HH:mm')}` : '';
            timeEl.textContent = `${startTime}${endTime}`;
          } else {
            // For all-day events, check if it's multi-day
            const eventStart = moment(event.start);
            const eventEnd = moment(event.end || event.start);
            const eventDuration = eventEnd.diff(eventStart, 'days') + 1;
            
            if (eventDuration > 1) {
              // Multi-day event - add indicator
              const dayNumber = day.diff(eventStart, 'days') + 1;
              
              if (dayNumber === 1) {
                // First day - show date range
                timeEl.textContent = `${eventStart.format('MMM D')} - ${eventEnd.format('MMM D')}`;
              } else if (dayNumber === eventDuration) {
                // Last day
                timeEl.textContent = `Final day`;
              } else {
                // Middle day
                timeEl.textContent = `Day ${dayNumber} of ${eventDuration}`;
              }
            } else {
              // Single day all-day event
              timeEl.textContent = 'All day';
            }
          }
          
          eventEl.appendChild(timeEl);
          
          // Event title
          const titleEl = document.createElement('div');
          titleEl.className = 'event-title';
          titleEl.textContent = event.title;
          eventEl.appendChild(titleEl);
          
          // Event location if present
          if (event.location) {
            const locationEl = document.createElement('div');
            locationEl.className = 'event-location';
            locationEl.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${event.location}`;
            eventEl.appendChild(locationEl);
          }
          
          // Click handler for event details
          eventEl.addEventListener('click', () => {
            const startTime = event.start ? moment(event.start).format('h:mm A') : '';
            const endTime = event.end ? moment(event.end).format('h:mm A') : '';
            let timeStr = startTime;
            if (endTime && !event.allDay) {
              timeStr += ` - ${endTime}`;
            }
            
            const eventInfo = `${event.title} ${timeStr ? '(' + timeStr + ')' : ''}`;
            document.getElementById('next-event-info').textContent = eventInfo;
          });
          
          eventsContainer.appendChild(eventEl);
        });
      }
      
      dayCol.appendChild(header);
      dayCol.appendChild(dayWeather);
      dayCol.appendChild(eventsContainer);
      grid.appendChild(dayCol);
    });
    
    // Replace container content
    container.innerHTML = '';
    container.appendChild(grid);
  }
  
  // Filter calendar events based on active user toggles
  function filterCalendarEvents() {
    const toggles = document.querySelectorAll('.user-toggle');
    const activeUserIds = Array.from(toggles)
      .filter(t => t.classList.contains('active'))
      .map(t => t.dataset.userId);
    
    // Get all event elements
    document.querySelectorAll('.calendar-event').forEach(eventEl => {
      const eventUserId = eventEl.dataset.userId;
      
      if (activeUserIds.includes(eventUserId)) {
        // Show event
        eventEl.classList.remove('filtered-out');
      } else {
        // Hide event with animation
        eventEl.classList.add('filtered-out');
      }
    });
  }
  function loadUserToggles() {
    const userToggles = document.getElementById('user-toggles');
    if (!userToggles) return;
    
    fetch('/api/users')
      .then(response => response.json())
      .then(users => {
        userToggles.innerHTML = '';
        
        if (Array.isArray(users)) {
          // Only show users with assigned calendars
          const usersWithCalendars = users.filter(user => user.calendarEntity);
          
          if (usersWithCalendars.length === 0) {
            userToggles.innerHTML = '<div class="no-users-message">No calendars assigned to users yet</div>';
            return;
          }
          
          usersWithCalendars.forEach(user => {
            const toggle = document.createElement('div');
            toggle.className = 'user-toggle active';
            toggle.dataset.userId = user.id;
            toggle.dataset.userName = user.name;
            toggle.dataset.calendarEntity = user.calendarEntity;
            toggle.style.backgroundColor = user.color;
            toggle.title = `${user.name} - Click to toggle events`;
            
            if (user.icon) {
              toggle.innerHTML = `<i class="fas ${user.icon}"></i>`;
            } else {
              toggle.textContent = user.name.charAt(0);
            }
            
            toggle.addEventListener('click', () => {
              toggle.classList.toggle('active');
              toggle.classList.toggle('inactive');
              
              // Filter calendar events
              filterCalendarEvents();
            });
            
            userToggles.appendChild(toggle);
          });
        }
      })
      .catch(error => {
        console.error('Error loading user toggles:', error);
        userToggles.innerHTML = '<div class="error">Failed to load users</div>';
      });
  }
  
  // Update next event in footer
  function updateNextEvent(events) {
    if (!events || events.length === 0) {
      document.getElementById('next-event-info').textContent = 'No upcoming events';
      return;
    }
    
    const now = new Date();
    
    // Find next event
    const upcomingEvents = events
      .filter(event => new Date(event.start) > now)
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    if (upcomingEvents.length === 0) {
      document.getElementById('next-event-info').textContent = 'No upcoming events';
      return;
    }
    
    const nextEvent = upcomingEvents[0];
    const startTime = moment(nextEvent.start).format('ddd, MMM D, h:mm A');
    document.getElementById('next-event-info').textContent = `${nextEvent.title} (${startTime})`;
  }
  
  // Update time display
  function updateTime() {
    const now = new Date();
    
    // Format time based on configuration (24h format for large display)
    let timeFormat = 'h:mm A';
    let largeTimeFormat = 'HH:mm';
    if (appConfig.time_format === '24h') {
      timeFormat = 'HH:mm';
      largeTimeFormat = 'HH:mm';
    } else {
      largeTimeFormat = 'h:mm';
    }
    
    // Update new 3-column header elements
    const dayOfWeekEl = document.getElementById('day-of-week');
    const fullDateEl = document.getElementById('full-date');
    const largeTimeEl = document.getElementById('large-time');
    
    if (dayOfWeekEl) {
      dayOfWeekEl.textContent = moment(now).format('dddd');
    }
    
    if (fullDateEl) {
      fullDateEl.textContent = moment(now).format('MMMM DD, YYYY');
    }
    
    if (largeTimeEl) {
      largeTimeEl.textContent = moment(now).format(largeTimeFormat);
    }
    
    // Keep old elements for backward compatibility
    const oldTimeEl = document.getElementById('current-time');
    const oldDateEl = document.getElementById('current-date');
    
    if (oldTimeEl) {
      oldTimeEl.textContent = moment(now).format(timeFormat);
    }
    
    if (oldDateEl) {
      oldDateEl.textContent = moment(now).format('dddd, MMMM D, Y');
    }
    
    setTimeout(updateTime, 1000);
  }
  
  // Fetch weather data
  function fetchWeather() {
    if (!appConfig.show_weather) return;
    
    fetch('/api/weather')
      .then(response => response.json())
      .then(data => {
        if (!data || data.enabled === false) return;
        if (!data.attributes) return;
        
        const attrs = data.attributes;
        const temp = attrs.temperature ? Math.round(attrs.temperature) : '--';
        const tempUnit = attrs.temperature_unit || '°F';
        const condition = data.state || 'unknown';
        
        // Update temperature
        const tempEl = document.getElementById('weather-temp');
        if (tempEl) {
          tempEl.textContent = `${temp}${tempUnit}`;
        }
        
        // Update condition text
        const conditionTextEl = document.getElementById('weather-condition-text');
        if (conditionTextEl) {
          const readableCondition = condition
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          conditionTextEl.textContent = readableCondition;
        }
        
        // Map Home Assistant weather condition to Font Awesome icon
        const iconMap = {
          'clear-night': 'fa-moon',
          'cloudy': 'fa-cloud',
          'fog': 'fa-smog',
          'hail': 'fa-cloud-meatball',
          'lightning': 'fa-bolt',
          'lightning-rainy': 'fa-bolt',
          'partlycloudy': 'fa-cloud-sun',
          'pouring': 'fa-cloud-showers-heavy',
          'rainy': 'fa-cloud-rain',
          'snowy': 'fa-snowflake',
          'snowy-rainy': 'fa-cloud-sleet',
          'sunny': 'fa-sun',
          'windy': 'fa-wind',
          'windy-variant': 'fa-wind',
          'exceptional': 'fa-exclamation-triangle'
        };
        
        // Update weather icon
        const iconEl = document.getElementById('weather-icon');
        if (iconEl) {
        const iconClass = iconMap[condition] || 'fa-cloud';
          iconEl.className = `fas ${iconClass}`;
        }
        
        // Update humidity
        const humidityEl = document.getElementById('weather-humidity');
        if (humidityEl && attrs.humidity !== undefined) {
          humidityEl.textContent = `${attrs.humidity}%`;
        }
        
        // Update pressure
        const pressureEl = document.getElementById('weather-pressure');
        if (pressureEl && attrs.pressure !== undefined) {
          const pressureUnit = attrs.pressure_unit || 'hPa';
          pressureEl.textContent = `${attrs.pressure} ${pressureUnit}`;
        }
        
        // Sunrise/sunset are fetched from sun entity separately
        fetchSunTimes();
        
        // Update wind
        const windEl = document.getElementById('weather-wind');
        if (windEl && attrs.wind_speed !== undefined) {
          const windSpeed = attrs.wind_speed;
          const windSpeedUnit = attrs.wind_speed_unit || 'km/h';
          const windBearing = attrs.wind_bearing;
          
          // Convert wind bearing to cardinal direction
          const getWindDirection = (bearing) => {
            if (bearing === undefined) return '';
            const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            const index = Math.round(bearing / 45) % 8;
            return directions[index];
          };
          
          const windDirection = getWindDirection(windBearing);
          const windText = windDirection 
            ? `${windDirection} ${windSpeed} ${windSpeedUnit}`
            : `${windSpeed} ${windSpeedUnit}`;
          
          windEl.querySelector('span').textContent = windText;
        }
        
        // Fetch forecast via service call
        fetchWeatherForecast();
        
        // Keep the old last updated for compatibility
        let lastUpdated = document.querySelector('.weather .last-updated');
        if (!lastUpdated) {
          lastUpdated = document.createElement('div');
          lastUpdated.className = 'last-updated';
          weatherContainer.appendChild(lastUpdated);
        }
        
        lastUpdated.textContent = `Updated: ${moment().format('h:mm A')}`;
      })
      .catch(error => {
        console.error('Error fetching weather data:', error);
      });
  }
  
  // Fetch sun times from sun entity
  function fetchSunTimes() {
    fetch('/api/sun')
      .then(response => response.json())
      .then(data => {
        if (!data || !data.attributes) return;
        
        const sunriseEl = document.getElementById('sun-sunrise');
        const sunsetEl = document.getElementById('sun-sunset');
        
        if (sunriseEl && data.attributes.next_rising) {
          const sunriseTime = new Date(data.attributes.next_rising);
          sunriseEl.textContent = sunriseTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        }
        
        if (sunsetEl && data.attributes.next_setting) {
          const sunsetTime = new Date(data.attributes.next_setting);
          sunsetEl.textContent = sunsetTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        }
      })
      .catch(error => {
        console.error('Error fetching sun times:', error);
      });
  }
  
  // Fetch weather forecast using get_forecasts service
  function fetchWeatherForecast() {
    fetch('/api/weather/forecast')
      .then(response => response.json())
      .then(data => {
        if (data && data.forecast && Array.isArray(data.forecast)) {
          forecastData = data.forecast; // Store globally for calendar use
          displayForecast(data.forecast);
          
          // Re-render calendar if it's already been rendered
          if (allCalendarEvents.length > 0) {
            renderCalendarGrid();
          }
        }
      })
      .catch(error => {
        console.error('Error fetching weather forecast:', error);
      });
  }
  
  // Display weather forecast
  function displayForecast(forecast) {
    const forecastContainer = document.getElementById('forecast-days');
    if (!forecastContainer || !forecast || forecast.length === 0) return;
    
    // Clear existing forecast
    forecastContainer.innerHTML = '';
    
    // Map weather conditions to icons
    const iconMap = {
      'clear-night': 'fa-moon',
      'cloudy': 'fa-cloud',
      'fog': 'fa-smog',
      'hail': 'fa-cloud-meatball',
      'lightning': 'fa-bolt',
      'lightning-rainy': 'fa-bolt',
      'partlycloudy': 'fa-cloud-sun',
      'pouring': 'fa-cloud-showers-heavy',
      'rainy': 'fa-cloud-rain',
      'snowy': 'fa-snowflake',
      'snowy-rainy': 'fa-cloud-sleet',
      'sunny': 'fa-sun',
      'windy': 'fa-wind',
      'windy-variant': 'fa-wind',
      'exceptional': 'fa-exclamation-triangle'
    };
    
    // Show next 5 days (or fewer if less available)
    const daysToShow = Math.min(5, forecast.length);
    
    for (let i = 0; i < daysToShow; i++) {
      const day = forecast[i];
      const forecastDate = new Date(day.datetime);
      const dayName = forecastDate.toLocaleDateString('en-US', { weekday: 'short' });
      
      const forecastDay = document.createElement('div');
      forecastDay.className = 'forecast-day';
      
      // Day name
      const dayNameEl = document.createElement('div');
      dayNameEl.className = 'forecast-day-name';
      dayNameEl.textContent = i === 0 ? 'Today' : dayName;
      
      // Weather icon
      const iconEl = document.createElement('i');
      iconEl.className = `fas ${iconMap[day.condition] || 'fa-cloud'} forecast-icon`;
      
      // Temperatures
      const tempsEl = document.createElement('div');
      tempsEl.className = 'forecast-temps';
      
      const highEl = document.createElement('div');
      highEl.className = 'forecast-high';
      highEl.textContent = day.temperature ? `${Math.round(day.temperature)}°` : '--';
      
      const lowEl = document.createElement('div');
      lowEl.className = 'forecast-low';
      lowEl.textContent = day.templow ? `${Math.round(day.templow)}°` : '--';
      
      tempsEl.appendChild(highEl);
      tempsEl.appendChild(lowEl);
      
      forecastDay.appendChild(dayNameEl);
      forecastDay.appendChild(iconEl);
      forecastDay.appendChild(tempsEl);
      
      forecastContainer.appendChild(forecastDay);
    }
  }
  
  // Update theme
  function updateTheme(theme) {
    const app = document.getElementById('app');
    app.className = `theme-${theme}`;
  }
  
  // Initial data load
  fetchCalendarEvents();
  fetchAndDisplayChores();
  fetchAndDisplayMeals(); // Call to fetch meals
  loadUserToggles(); // Load user toggles
  
  // Load weather data initially
  fetchWeather();
  fetchSunTimes();
  fetchWeatherForecast();
  
  // Set up periodic refresh
  setInterval(fetchCalendarEvents, 5 * 60 * 1000); // Refresh every 5 minutes
  setInterval(fetchWeather, 15 * 60 * 1000); // Refresh weather every 15 minutes
  setInterval(fetchSunTimes, 60 * 60 * 1000); // Refresh sun times every hour
  setInterval(fetchWeatherForecast, 60 * 60 * 1000); // Refresh forecast every hour
  
  // Listen for socket events
  socket.on('calendar_update', () => {
    fetchCalendarEvents();
  });
  
  socket.on('config_update', () => {
    fetch('/api/config')
      .then(response => response.json())
      .then(config => {
        appConfig = config;
        updateTheme(appConfig.theme);
        if (appConfig.show_weather) {
          fetchWeather();
          fetchSunTimes();
          fetchWeatherForecast();
          document.getElementById('weather-container').style.display = 'flex';
        } else {
          document.getElementById('weather-container').style.display = 'none';
        }
      });
  });
  
  // Handle keyboard shortcut to exit kiosk mode (ESC key)
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      socket.emit('exit_kiosk');
    }
  });

  // Tab switching logic
  const tabItems = document.querySelectorAll('.tab-item');
  const tabContents = document.querySelectorAll('.tab-content');

  tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tabTarget;
      const targetContent = document.getElementById(targetId);

      // Remove active state from all tabs and content
      tabItems.forEach(t => t.classList.remove('active-tab'));
      tabContents.forEach(c => c.classList.remove('active-content'));

      // Set active state for clicked tab and corresponding content
      tab.classList.add('active-tab');
      if (targetContent) {
        targetContent.classList.add('active-content');
      }
      
      // Special handling for calendar rendering when its tab becomes active
      if (targetId === 'calendar-content') {
        // Re-render custom calendar when tab becomes active
        setTimeout(() => {
          renderCalendarGrid();
        }, 0);
      }
    });
  });

  // Function to fetch and display chores in kanban format
  async function fetchAndDisplayChores() {
    try {
      const response = await fetch('/api/chores');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const chores = await response.json();
      const choreBoard = document.getElementById('chore-board');
      
      if (!choreBoard) {
        console.error('Chore board container not found!');
        return;
      }

      choreBoard.innerHTML = ''; // Clear previous content
      
      // Ensure chores is an array
      if (!Array.isArray(chores)) {
        console.error('Chores data is not an array:', chores);
        choreBoard.innerHTML = '<div class="error-message">No chores to display</div>';
        return;
      }
      
      // Group chores by assignee
      const choresByAssignee = {};
      
      // First, collect all unique assignees
      const assignees = [...new Set(chores.map(chore => 
        chore.assigneeName ? chore.assigneeName : 'Unassigned'))];
        
      // Create a lane for each assignee
      assignees.forEach(assignee => {
        const assigneeChores = chores.filter(chore => 
          (chore.assigneeName ? chore.assigneeName : 'Unassigned') === assignee);
          
        const laneId = assignee.toLowerCase().replace(/\s+/g, '-');
        const lane = document.createElement('div');
        lane.className = `kanban-lane lane-${laneId}`;
        
        const laneHeader = document.createElement('div');
        laneHeader.className = 'kanban-lane-header';
        
        const laneTitle = document.createElement('div');
        laneTitle.className = 'lane-title';
        
        // Determine icon based on assignee
        let icon = 'fa-user';
        if (assignee === 'Unassigned') {
          icon = 'fa-user-slash';
        }
        
        laneTitle.innerHTML = `
          <i class="fas ${icon}"></i>
          <span>${assignee}</span>
        `;
        
        const laneCount = document.createElement('div');
        laneCount.className = 'lane-count';
        laneCount.textContent = assigneeChores.length;
        
        laneHeader.appendChild(laneTitle);
        laneHeader.appendChild(laneCount);
        
        const items = document.createElement('div');
        items.className = 'kanban-items';
        
        // Add chores to this lane
        assigneeChores.forEach(chore => {
          const item = document.createElement('div');
          item.className = chore.completed ? 'kanban-item completed' : 'kanban-item';
          item.dataset.id = chore.id;
          
          // If we want to hide completed items
          if (hideCompleted && chore.completed) {
            item.style.display = 'none';
          }
          
          const title = document.createElement('div');
          title.className = 'item-title';
          title.textContent = chore.name;
          
          const itemMeta = document.createElement('div');
          itemMeta.className = 'item-meta';
          
          let dueHtml = '';
          if (chore.dueDate) {
            const dueDate = moment(chore.dueDate);
            const isOverdue = !chore.completed && dueDate.isBefore(moment(), 'day');
            const dueClass = isOverdue ? 'overdue' : '';
            
            dueHtml = `
              <div class="item-due ${dueClass}">
                <i class="fas fa-calendar-day"></i>
                <span>${dueDate.format('MMM D, YYYY')}</span>
              </div>
            `;
          }
          
          const statusHtml = `
            <div class="item-status">
              ${chore.completed ? 
                '<span class="status-badge done">Done</span>' : 
                '<span class="status-badge pending">Pending</span>'}
            </div>
          `;
          
          itemMeta.innerHTML = dueHtml + statusHtml;
          
          const itemActions = document.createElement('div');
          itemActions.className = 'item-actions';
          
          itemActions.innerHTML = `
            <button class="toggle-status-btn" data-id="${chore.id}">
              <i class="fas ${chore.completed ? 'fa-undo' : 'fa-check'}"></i>
            </button>
            <button class="delete-btn" data-id="${chore.id}">
              <i class="fas fa-trash-alt"></i>
            </button>
          `;
          
          item.appendChild(title);
          item.appendChild(itemMeta);
          item.appendChild(itemActions);
          items.appendChild(item);
        });
        
        lane.appendChild(laneHeader);
        lane.appendChild(items);
        choreBoard.appendChild(lane);
      });
      
      // Add event listeners for chore actions
      document.querySelectorAll('.toggle-status-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const choreId = button.dataset.id;
          const choreItem = button.closest('.kanban-item');
          const isCompleted = choreItem.classList.contains('completed');
          
          // In a real app, you'd update the status on the server
          // For now, we just toggle the UI
          if (isCompleted) {
            choreItem.classList.remove('completed');
            button.innerHTML = '<i class="fas fa-check"></i>';
            choreItem.querySelector('.status-badge').textContent = 'Pending';
            choreItem.querySelector('.status-badge').className = 'status-badge pending';
          } else {
            choreItem.classList.add('completed');
            button.innerHTML = '<i class="fas fa-undo"></i>';
            choreItem.querySelector('.status-badge').textContent = 'Done';
            choreItem.querySelector('.status-badge').className = 'status-badge done';
            
            if (hideCompleted) {
              choreItem.style.display = 'none';
            }
          }
        });
      });
      
      document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
          e.stopPropagation();
          const choreId = button.dataset.id;
          
          if (confirm('Are you sure you want to delete this chore?')) {
            try {
              const response = await fetch(`/api/chores/${choreId}`, {
                method: 'DELETE',
              });
              
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              
              // Refresh the board
              fetchAndDisplayChores();
            } catch (error) {
              console.error('Error deleting chore:', error);
              alert('Failed to delete chore: ' + error.message);
            }
          }
        });
      });

    } catch (error) {
      console.error('Error fetching or displaying chores:', error);
      const choreBoard = document.getElementById('chore-board');
      if (choreBoard) {
        choreBoard.innerHTML = '<p class="error-message">Could not load chores. Please try again.</p>';
      }
    }
  }

  // Event listener for adding a new chore
  const addChoreForm = document.getElementById('add-chore-form');
  if (addChoreForm) {
    addChoreForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      const choreName = event.target.choreName.value;
      const assigneeName = event.target.assigneeName.value;
      const dueDate = event.target.dueDate.value;

      if (!choreName) {
        alert('Chore name is required.');
        return;
      }

      try {
        const response = await fetch('/api/chores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: choreName, assigneeName, dueDate }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        // Close the modal
        closeModal('add-chore-modal');
        
        // Refresh the chore board
        fetchAndDisplayChores();
        
        // Clear the form
        event.target.reset();
      } catch (error) {
        console.error('Error adding chore:', error);
        alert(`Failed to add chore: ${error.message}`);
      }
    });
  }

  // Function to fetch and display meals in the weekly grid
  async function fetchAndDisplayMeals() {
    try {
      // First, ensure meal type rows exist
      await createMealPlanRows();
      
      const response = await fetch('/api/meals');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const mealDays = await response.json();
      
      // Clear all meal cells
      document.querySelectorAll('.meal-cell').forEach(cell => {
        cell.innerHTML = '';
        cell.classList.remove('has-meal');
      });
      
      // Ensure mealDays is an array
      if (!Array.isArray(mealDays)) {
        console.error('Meal data is not an array:', mealDays);
        return;
      }
      
      // Fill in meals for the current week
      mealDays.forEach(day => {
        const mealDate = moment(day.date);
        
        // Check if this meal is in the current week we're viewing
        if (mealDate.isBetween(currentWeekStart, moment(currentWeekStart).add(6, 'days'), null, '[]')) {
          // Calculate which day of the week this is (0-6)
          const dayOfWeek = mealDate.day() - 1; // -1 because our grid starts with Monday(0)
          const adjustedDay = dayOfWeek < 0 ? 6 : dayOfWeek; // Adjust for Sunday
          
          // Add each meal to the appropriate cell
          day.meals.forEach(meal => {
            const mealType = meal.type.toLowerCase();
            const cell = document.querySelector(`.meal-cell[data-day="${adjustedDay}"][data-type="${mealType}"]`);
            
            if (cell) {
              cell.innerHTML = `
                <div class="meal-name">${meal.description}</div>
              `;
              cell.classList.add('has-meal');
            }
          });
        }
      });
      
      // Add click handler for meal cells to add new meals
      document.querySelectorAll('.meal-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          const day = parseInt(cell.dataset.day);
          const type = cell.dataset.type;
          const date = moment(currentWeekStart).add(day, 'days').format('YYYY-MM-DD');
          
          // Open the add meal modal
          const addMealModal = document.getElementById('add-meal-modal');
          if (addMealModal) {
            // Set the meal date in the form
            document.getElementById('mealDate').value = date;
            
            // Select the correct meal type
            const mealTypeSelect = document.getElementById('mealType');
            if (mealTypeSelect) {
              for (let i = 0; i < mealTypeSelect.options.length; i++) {
                if (mealTypeSelect.options[i].value.toLowerCase() === type) {
                  mealTypeSelect.selectedIndex = i;
                  break;
                }
              }
            }
            
            // Open the modal
            addMealModal.classList.add('show');
          }
        });
      });
      
    } catch (error) {
      console.error('Error fetching or displaying meal plan:', error);
      alert('Failed to load meal plan: ' + error.message);
    }
  }
  
  // Function to create meal plan rows for each meal type
  async function createMealPlanRows() {
    const mealPlanGrid = document.getElementById('meal-plan-grid');
    if (!mealPlanGrid) return;
    
    let mealTypes = ['breakfast', 'lunch', 'dinner']; // Default fallback
    
    try {
      // Fetch meal categories from API
      const response = await fetch('/api/meal-categories');
      if (response.ok) {
        const categories = await response.json();
        if (Array.isArray(categories) && categories.length > 0) {
          mealTypes = categories.map(cat => cat.name.toLowerCase());
        }
      }
    } catch (error) {
      console.error('Error fetching meal categories for rows:', error);
      // Continue with default types
    }
    
    // Remove existing meal rows (not the header)
    const existingRows = mealPlanGrid.querySelectorAll('.meal-plan-row');
    existingRows.forEach(row => row.remove());
    
    // Create a row for each meal type
    mealTypes.forEach(type => {
      const row = document.createElement('div');
      row.className = 'meal-plan-row';
      row.dataset.mealType = type;
      
      // Add type header cell
      const typeCell = document.createElement('div');
      typeCell.className = 'meal-plan-cell meal-type-cell';
      typeCell.innerHTML = `
        <i class="fas fa-utensils"></i>
        <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
      `;
      row.appendChild(typeCell);
      
      // Add a cell for each day of the week
      for (let day = 0; day < 7; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'meal-plan-cell meal-cell';
        dayCell.dataset.day = day;
        dayCell.dataset.type = type;
        
        // Mark today's cell
        const dayDate = moment(currentWeekStart).add(day, 'days');
        if (dayDate.isSame(moment(), 'day')) {
          dayCell.classList.add('today');
        }
        
        row.appendChild(dayCell);
      }
      
      mealPlanGrid.appendChild(row);
    });
  }
  
  // Meal category management
  document.querySelectorAll('.category-edit').forEach(button => {
    button.addEventListener('click', () => {
      const categoryItem = button.closest('.category-item');
      const categoryName = categoryItem.querySelector('.category-name span').textContent;
      
      const newName = prompt('Edit category name:', categoryName);
      if (newName && newName !== categoryName) {
        categoryItem.querySelector('.category-name span').textContent = newName;
        // In a real app, you would save this to the server
      }
    });
  });
  
  document.getElementById('add-category')?.addEventListener('click', () => {
    const newName = prompt('Enter new category name:');
    if (newName) {
      const categoriesContainer = document.getElementById('meal-categories-container');
      const newCategory = document.createElement('div');
      newCategory.className = 'category-item';
      newCategory.innerHTML = `
        <div class="category-name">
          <span>${newName}</span>
          <button class="category-edit"><i class="fas fa-pencil-alt"></i></button>
        </div>
      `;
      
      categoriesContainer.appendChild(newCategory);
      
      // Add event listener to the new edit button
      newCategory.querySelector('.category-edit').addEventListener('click', () => {
        const categoryName = newCategory.querySelector('.category-name span').textContent;
        const updatedName = prompt('Edit category name:', categoryName);
        if (updatedName && updatedName !== categoryName) {
          newCategory.querySelector('.category-name span').textContent = updatedName;
        }
      });
    }
  });

  // Handle game item clicks
  document.querySelectorAll('.game-item').forEach(gameItem => {
    gameItem.addEventListener('click', () => {
      const gameUrl = gameItem.dataset.gameUrl;
      const gameTitle = gameItem.querySelector('.game-title').textContent;
      
      // Set the iframe source and modal title
      document.getElementById('game-iframe').src = gameUrl;
      document.getElementById('game-modal-title').textContent = gameTitle;
      
      // Open the modal
      openModal('game-focus-modal');
    });
  });

  // Recipe Book Button
  const recipeBookButton = document.getElementById('recipe-book-button');
  if (recipeBookButton) {
    recipeBookButton.addEventListener('click', () => {
      loadRecipes(); // Load recipes when opening the modal
      openModal('recipe-book-modal');
    });
  }

  // Add Recipe Button
  const addRecipeButton = document.getElementById('add-recipe-button');
  if (addRecipeButton) {
    addRecipeButton.addEventListener('click', () => {
      // Close the recipe book modal
      closeModal('recipe-book-modal');
      
      // Open the add recipe modal
      openModal('add-recipe-modal');
    });
  }

  // Add event listener for recipe edit functionality
  document.querySelectorAll('.edit-recipe-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent recipe selection
      const recipeId = e.target.closest('.recipe-list-item').dataset.recipeId;
      editRecipe(recipeId);
    });
  });

  // Function to edit a recipe
  function editRecipe(recipeId) {
    // Find the recipe in the loaded recipes
    const recipeItem = document.querySelector(`.recipe-list-item[data-recipe-id="${recipeId}"]`);
    if (!recipeItem) return;
    
    // Get recipe details
    const recipeName = recipeItem.querySelector('.recipe-list-item-name').textContent;
    const recipeType = recipeItem.querySelector('.recipe-list-item-type').textContent;
    
    // Get full recipe details - this would typically fetch from the server
    fetch(`/api/recipes/${recipeId}`)
      .then(response => response.json())
      .then(recipe => {
        // Close the recipe book modal
        closeModal('recipe-book-modal');
        
        // Open and populate the add/edit recipe modal
        const editModal = document.getElementById('add-recipe-modal');
        if (editModal) {
          // Populate form with recipe data
          const form = editModal.querySelector('form');
          if (form) {
            form.reset();
            form.querySelector('#recipe-id').value = recipe.id;
            form.querySelector('#recipe-name').value = recipe.name;
            form.querySelector('#recipe-type').value = recipe.type;
            form.querySelector('#recipe-description').value = recipe.description;
            form.querySelector('#recipe-instructions').value = recipe.instructions;
            
            // Populate ingredients
            const ingredientsList = form.querySelector('#recipe-ingredients-list');
            if (ingredientsList) {
              ingredientsList.innerHTML = '';
              recipe.ingredients.forEach(ingredient => {
                addIngredientInput(ingredient);
              });
            }
            
            // Change submit button text to "Update Recipe"
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
              submitButton.innerHTML = '<i class="fas fa-save"></i> Update Recipe';
            }
            
            // Change modal title
            const modalTitle = editModal.querySelector('.modal-header h3');
            if (modalTitle) {
              modalTitle.textContent = 'Edit Recipe';
            }
          }
          
          openModal('add-recipe-modal');
        }
      })
      .catch(error => {
        console.error('Error loading recipe for editing:', error);
        alert('Failed to load recipe details');
      });
  }

  // Function to add ingredient input fields to the add/edit recipe form
  function addIngredientInput(ingredient = { name: '', amount: '', available: false }) {
    const ingredientsList = document.getElementById('recipe-ingredients-list');
    if (!ingredientsList) return;
    
    const ingredientItem = document.createElement('div');
    ingredientItem.className = 'ingredient-input-row';
    
    ingredientItem.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <input type="text" class="ingredient-name" placeholder="Ingredient name" value="${ingredient.name}" required>
        </div>
        <div class="form-group">
          <input type="text" class="ingredient-amount" placeholder="Amount" value="${ingredient.amount}">
        </div>
        <button type="button" class="btn btn-sm btn-danger remove-ingredient">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    
    // Add event listener to remove button
    const removeButton = ingredientItem.querySelector('.remove-ingredient');
    if (removeButton) {
      removeButton.addEventListener('click', () => {
        ingredientItem.remove();
      });
    }
    
    ingredientsList.appendChild(ingredientItem);
  }

  // Add ingredient button event listener
  const addIngredientButton = document.getElementById('add-ingredient-button');
  if (addIngredientButton) {
    addIngredientButton.addEventListener('click', () => {
      addIngredientInput();
    });
  }
  
  // Grocery list button
  const groceryListButton = document.getElementById('grocery-list-button');
  if (groceryListButton) {
    groceryListButton.addEventListener('click', () => {
      loadGroceryList(); // Load grocery list when opening the modal
      openModal('grocery-list-modal');
    });
  }
  
  // Select recipe button in add meal form
  const selectRecipeBtn = document.getElementById('select-recipe-btn');
  if (selectRecipeBtn) {
    selectRecipeBtn.addEventListener('click', () => {
      loadRecipes(); // Load recipes when opening the modal
      openModal('recipe-book-modal');
      
      // Set a flag to indicate we're selecting a recipe for the meal plan
      document.body.dataset.selectingForMeal = 'true';
    });
  }
  
  // Handle "Add to Meal Plan" button in recipe detail
  const addToMealPlanBtn = document.getElementById('add-to-meal-plan');
  if (addToMealPlanBtn) {
    addToMealPlanBtn.addEventListener('click', () => {
      // Get the selected recipe
      const recipeId = addToMealPlanBtn.dataset.recipeId;
      const recipeName = document.getElementById('recipe-name').textContent;
      
      // If we're selecting for the meal form, fill in the form and close the recipe book
      if (document.body.dataset.selectingForMeal === 'true') {
        document.getElementById('mealDescription').value = recipeName;
        document.getElementById('recipeId').value = recipeId;
        closeModal('recipe-book-modal');
        document.body.dataset.selectingForMeal = 'false';
      } else {
        // Otherwise, add the recipe to today's meal plan
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        const mealType = document.querySelector('.recipe-list-item.active .recipe-list-item-type').textContent;
        
        // Here you would save the meal to the server
        alert(`Added ${recipeName} to ${mealType} for today (${formattedDate})`);
      }
    });
  }
  
  // Add grocery item form submission
  const addGroceryItemForm = document.getElementById('add-grocery-item-form');
  if (addGroceryItemForm) {
    addGroceryItemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const nameInput = document.getElementById('groceryItemName');
      const quantityInput = document.getElementById('groceryItemQuantity');
      
      const name = nameInput.value.trim();
      const quantity = quantityInput.value.trim();
      
      if (name) {
        try {
          const response = await fetch('/api/grocery-list', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, quantity })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // Clear form inputs
          nameInput.value = '';
          quantityInput.value = '';
          
          // Reload the grocery list
          loadGroceryList();
          
        } catch (error) {
          console.error('Error adding grocery item:', error);
          alert('Failed to add item to grocery list');
        }
      }
    });
  }
  
  // Add meal form submission
  const addMealForm = document.getElementById('add-meal-form');
  if (addMealForm) {
    addMealForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const description = document.getElementById('mealDescription').value.trim();
      const mealType = document.getElementById('mealType').value;
      const mealDate = document.getElementById('mealDate').value;
      const recipeId = document.getElementById('recipeId').value;
      const cook = document.getElementById('mealCook')?.value.trim() || '';
      
      if (description && mealType && mealDate) {
        try {
          const response = await fetch('/api/meals', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              description,
              type: mealType,
              date: mealDate,
              recipeId: recipeId || null,
              cook
            })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // Close the modal and refresh the meal plan
          document.getElementById('mealDescription').value = '';
          document.getElementById('recipeId').value = '';
          document.getElementById('mealCook').value = '';
          closeModal('add-meal-modal');
          
          // Refresh the meal plan
          fetchAndDisplayMeals();
          
        } catch (error) {
          console.error('Error adding meal:', error);
          alert('Failed to add meal: ' + error.message);
        }
      }
    });
  }
  
  // Function to load recipes into the recipe book
  async function loadRecipes() {
    const recipeList = document.querySelector('.recipe-list');
    if (!recipeList) return;
    
    // Show loading placeholder
    recipeList.innerHTML = `
      <div class="recipe-list-placeholder">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading recipes...</p>
      </div>
    `;
    
    try {
      const response = await fetch('/api/recipes');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const recipes = await response.json();
      
      // Clear the recipe list
      recipeList.innerHTML = '';
      
      // Populate recipe list
      recipes.forEach(recipe => {
        const recipeItem = document.createElement('div');
        recipeItem.className = 'recipe-list-item';
        recipeItem.dataset.recipeId = recipe.id;
        
        recipeItem.innerHTML = `
          <div class="recipe-list-item-name">${recipe.name}</div>
          <div class="recipe-list-item-type">${recipe.type}</div>
        `;
        
        recipeItem.addEventListener('click', () => {
          // Remove active class from all recipes
          document.querySelectorAll('.recipe-list-item').forEach(item => {
            item.classList.remove('active');
          });
          
          // Add active class to clicked recipe
          recipeItem.classList.add('active');
          
          // Load recipe details
          loadRecipeDetails(recipe.id);
        });
        
        recipeList.appendChild(recipeItem);
      });
      
      // If we have recipes, select the first one by default
      if (recipes.length > 0) {
        const firstRecipe = recipeList.querySelector('.recipe-list-item');
        if (firstRecipe) {
          firstRecipe.classList.add('active');
          loadRecipeDetails(recipes[0].id);
        }
      } else {
        // If no recipes, show empty state
        recipeList.innerHTML = `
          <div class="recipe-list-placeholder">
            <i class="fas fa-book"></i>
            <p>No recipes found</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading recipes:', error);
      recipeList.innerHTML = `
        <div class="recipe-list-placeholder">
          <i class="fas fa-exclamation-circle"></i>
          <p>Failed to load recipes</p>
        </div>
      `;
    }
  }
  
  // Function to load recipe details
  async function loadRecipeDetails(recipeId) {
    const recipeDetail = document.querySelector('.recipe-detail');
    const recipeDetailContent = document.querySelector('.recipe-detail-content');
    const recipePlaceholder = document.querySelector('.recipe-detail-placeholder');
    
    if (!recipeDetail || !recipeDetailContent || !recipePlaceholder) return;
    
    // Hide content, show placeholder with loading
    recipeDetailContent.style.display = 'none';
    recipePlaceholder.innerHTML = `
      <i class="fas fa-spinner fa-spin"></i>
      <p>Loading recipe details...</p>
    `;
    recipePlaceholder.style.display = 'flex';
    
    try {
      const response = await fetch(`/api/recipes/${recipeId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const recipe = await response.json();
      
      // Update recipe image
      document.getElementById('recipe-image').src = recipe.image;
      document.getElementById('recipe-image').alt = recipe.name;
      
      // Update recipe info
      document.getElementById('recipe-name').textContent = recipe.name;
      document.getElementById('recipe-description').textContent = recipe.description;
      
      // Set recipe ID for "Add to Meal Plan" button
      document.getElementById('add-to-meal-plan').dataset.recipeId = recipe.id;
      
      // Update ingredients list
      const ingredientsList = document.getElementById('recipe-ingredients-list');
      ingredientsList.innerHTML = '';
      
      recipe.ingredients.forEach(ingredient => {
        const li = document.createElement('li');
        li.className = 'recipe-ingredient-item';
        
        const availableClass = ingredient.available ? 'available' : '';
        const availableIcon = ingredient.available ? '<i class="fas fa-check"></i>' : '';
        const purchasedDate = ingredient.lastPurchased 
          ? `<span class="ingredient-purchased-date">Purchased: ${formatDate(ingredient.lastPurchased)}</span>` 
          : '';
        
        li.innerHTML = `
          <div class="ingredient-check">
            <div class="ingredient-status ${availableClass}" data-ingredient="${ingredient.name}">${availableIcon}</div>
          </div>
          <div class="ingredient-name">${ingredient.name}${purchasedDate}</div>
          <div class="ingredient-amount">${ingredient.amount}</div>
          <button class="add-to-grocery" data-ingredient="${ingredient.name}" data-amount="${ingredient.amount}">
            <i class="fas fa-cart-plus"></i>
          </button>
        `;
        
        ingredientsList.appendChild(li);
      });
      
      // Update instructions
      document.getElementById('recipe-instructions-text').textContent = recipe.instructions;
      
      // Show recipe details
      recipePlaceholder.style.display = 'none';
      recipeDetailContent.style.display = 'block';
      
      // Add event listeners for ingredient actions
      addIngredientEventListeners();
      
    } catch (error) {
      console.error('Error loading recipe details:', error);
      recipePlaceholder.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <p>Failed to load recipe details</p>
      `;
    }
  }
  
  // Function to add event listeners to ingredient actions
  function addIngredientEventListeners() {
    // Ingredient status toggle
    document.querySelectorAll('.ingredient-status').forEach(status => {
      status.addEventListener('click', () => {
        status.classList.toggle('available');
        
        if (status.classList.contains('available')) {
          status.innerHTML = '<i class="fas fa-check"></i>';
          
          // Create purchased date element if it doesn't exist
          let purchasedDate = status.closest('.recipe-ingredient-item').querySelector('.ingredient-purchased-date');
          if (!purchasedDate) {
            purchasedDate = document.createElement('span');
            purchasedDate.className = 'ingredient-purchased-date';
            status.closest('.recipe-ingredient-item').querySelector('.ingredient-name').appendChild(purchasedDate);
          }
          
          // Update purchased date
          const today = new Date();
          purchasedDate.textContent = `Purchased: ${formatDate(today.toISOString().split('T')[0])}`;
        } else {
          status.innerHTML = '';
        }
        
        // In a real app, you would save this change to the server
      });
    });
    
    // Add to grocery list
    document.querySelectorAll('.add-to-grocery').forEach(button => {
      button.addEventListener('click', async () => {
        const ingredientName = button.dataset.ingredient;
        const ingredientAmount = button.dataset.amount;
        
        try {
          const response = await fetch('/api/grocery-list', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              name: ingredientName, 
              quantity: ingredientAmount 
            })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          alert(`Added ${ingredientName} to grocery list`);
        } catch (error) {
          console.error('Error adding to grocery list:', error);
          alert('Failed to add item to grocery list');
        }
      });
    });
  }
  
  // Function to load grocery list
  async function loadGroceryList() {
    const groceryList = document.getElementById('grocery-items-list');
    if (!groceryList) return;
    
    // Show loading placeholder
    groceryList.innerHTML = `
      <li class="loading-items">
        <i class="fas fa-spinner fa-spin"></i> Loading items...
      </li>
    `;
    
    try {
      const response = await fetch('/api/grocery-list');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const groceryData = await response.json();
      
      // Clear the grocery list
      groceryList.innerHTML = '';
      
      if (groceryData.items.length === 0) {
        groceryList.innerHTML = `
          <li class="empty-list-message">
            Your grocery list is empty
          </li>
        `;
        return;
      }
      
      // Populate grocery list
      groceryData.items.forEach(item => {
        const li = document.createElement('li');
        li.className = `grocery-item ${item.checked ? 'checked' : ''}`;
        li.dataset.id = item.id;
        
        li.innerHTML = `
          <div class="grocery-item-check">
            <input type="checkbox" ${item.checked ? 'checked' : ''}>
          </div>
          <div class="grocery-item-name">${item.name}</div>
          <div class="grocery-item-quantity">${item.quantity}</div>
          <button class="grocery-item-delete">
            <i class="fas fa-trash-alt"></i>
          </button>
        `;
        
        groceryList.appendChild(li);
      });
      
      // Add event listeners for grocery item actions
      addGroceryItemEventListeners();
      
    } catch (error) {
      console.error('Error loading grocery list:', error);
      groceryList.innerHTML = `
        <li class="error-message">
          Failed to load grocery list
        </li>
      `;
    }
  }
  
  // Function to add event listeners to grocery item actions
  function addGroceryItemEventListeners() {
    // Checkbox toggle
    document.querySelectorAll('.grocery-item-check input').forEach(checkbox => {
      checkbox.addEventListener('change', async () => {
        const item = checkbox.closest('.grocery-item');
        const itemId = item.dataset.id;
        const checked = checkbox.checked;
        
        try {
          const response = await fetch(`/api/grocery-list/${itemId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ checked })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // Update UI
          if (checked) {
            item.classList.add('checked');
          } else {
            item.classList.remove('checked');
          }
        } catch (error) {
          console.error('Error updating grocery item:', error);
          // Revert the checkbox state
          checkbox.checked = !checked;
        }
      });
    });
    
    // Delete button
    document.querySelectorAll('.grocery-item-delete').forEach(button => {
      button.addEventListener('click', async () => {
        const item = button.closest('.grocery-item');
        const itemId = item.dataset.id;
        
        if (confirm('Are you sure you want to remove this item?')) {
          try {
            const response = await fetch(`/api/grocery-list/${itemId}`, {
              method: 'DELETE'
            });
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Remove item from UI
            item.remove();
            
            // If list is now empty, show message
            if (document.querySelectorAll('.grocery-item').length === 0) {
              document.getElementById('grocery-items-list').innerHTML = `
                <li class="empty-list-message">
                  Your grocery list is empty
                </li>
              `;
            }
          } catch (error) {
            console.error('Error deleting grocery item:', error);
            alert('Failed to delete item');
          }
        }
      });
    });
  }
  
  // Helper function to format dates
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString(appConfig.locale, {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  }
  
  // Initialize the page
  fetchAndDisplayChores();
  updateMealWeekDates(); // This will also call fetchAndDisplayMeals

  // Profile Management in Settings
  const profileListSettings = document.getElementById('profile-list-settings');
  const addProfileButton = document.getElementById('add-profile-button');
  const editProfileModal = document.getElementById('edit-profile-modal');
  const editProfileForm = document.getElementById('edit-profile-form');
  const profileEditTitle = document.getElementById('profile-edit-title');
  const deleteProfileBtn = document.getElementById('delete-profile-btn');
  
  // Color and icon selectors
  const colorSelector = document.getElementById('profile-color-selector');
  const iconSelector = document.getElementById('profile-icon-selector');
  
  // Profile photo
  const profilePhotoPreview = document.getElementById('profile-photo-preview');
  const takePhotoBtn = document.getElementById('take-profile-photo');
  const uploadPhotoBtn = document.getElementById('upload-profile-photo');
  const photoInput = document.getElementById('profile-photo-input');
  
  // Load user profiles to settings
  async function loadProfilesForSettings() {
    try {
      const response = await fetch('/api/users');
      const users = await response.json();
      
      if (profileListSettings) {
        profileListSettings.innerHTML = '';
        
        if (!Array.isArray(users)) {
          console.error('Users data is not an array:', users);
          profileListSettings.innerHTML = '<div class="error-message">Failed to load profiles</div>';
          return;
        }
        
        users.forEach(user => {
          const profileItem = document.createElement('div');
          profileItem.className = 'profile-item-settings';
          profileItem.dataset.userId = user.id;
          
          profileItem.innerHTML = `
            <div class="profile-avatar-settings" style="background-color: ${user.color};">
              <i class="fas ${user.icon}"></i>
            </div>
            <div class="profile-name-settings">${user.name}</div>
            <div class="profile-meta">Game time: ${user.gameTimeLimit || 30} min/day</div>
            <button class="profile-edit-btn"><i class="fas fa-pencil-alt"></i></button>
          `;
          
          // Edit profile click
          const editBtn = profileItem.querySelector('.profile-edit-btn');
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openProfileEdit(user);
          });
          
          // Also allow editing by clicking the entire card
          profileItem.addEventListener('click', () => {
            openProfileEdit(user);
          });
          
          profileListSettings.appendChild(profileItem);
        });
      }
    } catch (error) {
      console.error('Error loading profiles for settings:', error);
    }
  }
  
  // Load available calendars and populate dropdown
  async function loadAvailableCalendars(currentUserCalendar = null) {
    try {
      const [calendarsResponse, usersResponse] = await Promise.all([
        fetch('/api/calendars/list'),
        fetch('/api/users')
      ]);
      
      const availableCalendars = await calendarsResponse.json();
      const users = await usersResponse.json();
      
      // Get list of already assigned calendars (excluding current user's)
      const assignedCalendars = users
        .filter(u => u.calendarEntity && u.calendarEntity !== currentUserCalendar)
        .map(u => u.calendarEntity);
      
      const calendarSelect = document.getElementById('profile-calendar');
      calendarSelect.innerHTML = '<option value="">None</option>';
      
      availableCalendars.forEach(cal => {
        const option = document.createElement('option');
        option.value = cal.entity_id;
        option.textContent = cal.name;
        
        // Disable if already assigned to another user
        if (assignedCalendars.includes(cal.entity_id)) {
          option.disabled = true;
          option.textContent += ' (Already assigned)';
        }
        
        calendarSelect.appendChild(option);
      });
      
      // Set selected calendar if provided
      if (currentUserCalendar) {
        calendarSelect.value = currentUserCalendar;
      }
    } catch (error) {
      console.error('Error loading available calendars:', error);
    }
  }
  
  // Open profile edit
  async function openProfileEdit(user) {
    // Set form title
    profileEditTitle.textContent = user ? 'Edit Profile' : 'Add New Profile';
    
    // Reset form
    editProfileForm.reset();
    
    // Clear previous selections
    document.querySelectorAll('.color-option.selected, .icon-option.selected').forEach(el => {
      el.classList.remove('selected');
    });
    
    // Load available calendars
    await loadAvailableCalendars(user ? user.calendarEntity : null);
    
    // If editing an existing user, populate form
    if (user) {
      document.getElementById('profile-id').value = user.id;
      document.getElementById('profile-name').value = user.name;
      document.getElementById('profile-color').value = user.color;
      document.getElementById('profile-icon').value = user.icon;
      document.getElementById('profile-game-time-limit').value = user.gameTimeLimit || 30;
      
      // Set calendar if assigned
      if (user.calendarEntity) {
        document.getElementById('profile-calendar').value = user.calendarEntity;
      }
      
      // Select color
      const colorOption = document.querySelector(`.color-option[data-color="${user.color}"]`);
      if (colorOption) colorOption.classList.add('selected');
      
      // Select icon
      const iconOption = document.querySelector(`.icon-option[data-icon="${user.icon}"]`);
      if (iconOption) iconOption.classList.add('selected');
      
      // Set profile photo if exists
      if (user.photo) {
        profilePhotoPreview.innerHTML = `<img src="${user.photo}" alt="${user.name}">`;
        document.getElementById('profile-photo-data').value = user.photo;
      } else {
        profilePhotoPreview.innerHTML = `<i class="fas ${user.icon}"></i>`;
      }
      
      // Show delete button for existing profiles
      deleteProfileBtn.style.display = 'block';
    } else {
      // New profile, set defaults
      document.getElementById('profile-id').value = '';
      document.getElementById('profile-color').value = '#4285f4';
      document.getElementById('profile-icon').value = 'fa-user';
      
      // Select default color and icon
      document.querySelector('.color-option[data-color="#4285f4"]').classList.add('selected');
      document.querySelector('.icon-option[data-icon="fa-user"]').classList.add('selected');
      
      // Reset profile photo
      profilePhotoPreview.innerHTML = '<i class="fas fa-user"></i>';
      document.getElementById('profile-photo-data').value = '';
      
      // Hide delete button for new profiles
      deleteProfileBtn.style.display = 'none';
    }
    
    // Open modal
    editProfileModal.classList.add('show');
  }
  
  // Add new profile
  if (addProfileButton) {
    addProfileButton.addEventListener('click', () => {
      openProfileEdit(null); // null indicates new profile
    });
  }
  
  // Color selector
  if (colorSelector) {
    colorSelector.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', () => {
        // Remove selected class from all options
        colorSelector.querySelectorAll('.color-option').forEach(o => {
          o.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        option.classList.add('selected');
        
        // Update hidden input
        document.getElementById('profile-color').value = option.dataset.color;
        
        // Update avatar preview background
        profilePhotoPreview.style.backgroundColor = option.dataset.color;
      });
    });
  }
  
  // Icon selector
  if (iconSelector) {
    iconSelector.querySelectorAll('.icon-option').forEach(option => {
      option.addEventListener('click', () => {
        // Remove selected class from all options
        iconSelector.querySelectorAll('.icon-option').forEach(o => {
          o.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        option.classList.add('selected');
        
        // Update hidden input
        document.getElementById('profile-icon').value = option.dataset.icon;
        
        // Update avatar preview icon if no photo
        if (!document.getElementById('profile-photo-data').value) {
          profilePhotoPreview.innerHTML = `<i class="fas ${option.dataset.icon}"></i>`;
        }
      });
    });
  }
  
  // Take profile photo
  if (takePhotoBtn) {
    takePhotoBtn.addEventListener('click', () => {
      // Create camera modal
      const cameraModal = document.createElement('div');
      cameraModal.className = 'modal camera-modal';
      cameraModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Take Profile Photo</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <video id="camera-feed" autoplay playsinline></video>
            <div class="camera-actions">
              <button id="capture-photo" class="btn btn-primary"><i class="fas fa-camera"></i> Take Photo</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(cameraModal);
      cameraModal.classList.add('show');
      
      // Get camera feed
      const video = document.getElementById('camera-feed');
      let stream = null;
      
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(cameraStream => {
          stream = cameraStream;
          video.srcObject = stream;
        })
        .catch(error => {
          console.error('Error accessing camera:', error);
          alert('Could not access the camera. Please check your permissions.');
        });
      
      // Capture photo
      document.getElementById('capture-photo').addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        // Convert to data URL
        const photoData = canvas.toDataURL('image/jpeg');
        
        // Update preview and hidden input
        profilePhotoPreview.innerHTML = `<img src="${photoData}" alt="Profile Photo">`;
        document.getElementById('profile-photo-data').value = photoData;
        
        // Stop stream and close modal
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        cameraModal.classList.remove('show');
        setTimeout(() => {
          cameraModal.remove();
        }, 300);
      });
      
      // Close button
      cameraModal.querySelector('.modal-close').addEventListener('click', () => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        cameraModal.classList.remove('show');
        setTimeout(() => {
          cameraModal.remove();
        }, 300);
      });
    });
  }
  
  // Upload profile photo
  if (uploadPhotoBtn && photoInput) {
    uploadPhotoBtn.addEventListener('click', () => {
      photoInput.click();
    });
    
    photoInput.addEventListener('change', () => {
      if (photoInput.files && photoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const photoData = e.target.result;
          
          // Update preview and hidden input
          profilePhotoPreview.innerHTML = `<img src="${photoData}" alt="Profile Photo">`;
          document.getElementById('profile-photo-data').value = photoData;
        };
        reader.readAsDataURL(photoInput.files[0]);
      }
    });
  }
  
  // Save profile
  if (editProfileForm) {
    editProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const profileId = document.getElementById('profile-id').value;
      const calendarValue = document.getElementById('profile-calendar').value;
      
      const profileData = {
        name: document.getElementById('profile-name').value,
        color: document.getElementById('profile-color').value,
        icon: document.getElementById('profile-icon').value,
        photo: document.getElementById('profile-photo-data').value || null,
        calendarEntity: calendarValue || null,
        gameTimeLimit: parseInt(document.getElementById('profile-game-time-limit').value, 10)
      };
      
      try {
        let response;
        
        if (profileId) {
          // Update existing profile
          console.log('Updating profile:', profileId, profileData);
          response = await fetch(`/api/users/${profileId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
          });
        } else {
          // Create new profile
          console.log('Creating new profile:', profileData);
          response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
          });
        }
        
        if (!response.ok) {
          throw new Error(`Failed to save profile: ${response.statusText}`);
        }
        
        const savedProfile = await response.json();
        console.log('Profile saved successfully:', savedProfile);
        
        // Close modal
        editProfileModal.classList.remove('show');
        
        // Reload profiles
        loadProfilesForSettings();
        loadUserToggles(); // Also reload user toggles for calendar
      } catch (error) {
        console.error('Error saving profile:', error);
        alert('Failed to save profile: ' + error.message);
      }
    });
  }
  
  // Delete profile
  if (deleteProfileBtn) {
    deleteProfileBtn.addEventListener('click', async () => {
      const profileId = document.getElementById('profile-id').value;
      
      if (!profileId) return;
      
      if (confirm('Are you sure you want to delete this profile? This cannot be undone.')) {
        try {
          console.log('Deleting profile:', profileId);
          
          const response = await fetch(`/api/users/${profileId}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            throw new Error(`Failed to delete profile: ${response.statusText}`);
          }
          
          console.log('Profile deleted successfully');
          
          // Close modal
          editProfileModal.classList.remove('show');
          
          // Reload profiles
          loadProfilesForSettings();
          loadUserToggles(); // Also reload user toggles for calendar
        } catch (error) {
          console.error('Error deleting profile:', error);
          alert('Failed to delete profile: ' + error.message);
        }
      }
    });
  }
  
  // Load profiles when settings tab is active
  document.querySelector('.tab-item[data-tab-target="settings-content"]').addEventListener('click', () => {
    loadProfilesForSettings();
  });

  // Theme buttons
  document.querySelectorAll('.theme-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const theme = e.currentTarget.dataset.theme;
      setTheme(theme);
      
      // Set active state on this button and remove from others
      document.querySelectorAll('.theme-button').forEach(btn => {
        btn.classList.remove('active');
      });
      e.currentTarget.classList.add('active');
      
      // Save theme preference
      fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ theme })
      }).catch(error => console.error('Error saving theme:', error));
    });
  });

  // Mark active theme on page load
  function markActiveTheme() {
    const currentTheme = getComputedStyle(document.documentElement).getPropertyValue('--theme-name').trim().replace(/"/g, '');
    const themeButton = document.querySelector(`.theme-button[data-theme="${currentTheme}"]`);
    if (themeButton) {
      document.querySelectorAll('.theme-button').forEach(btn => {
        btn.classList.remove('active');
      });
      themeButton.classList.add('active');
    }
  }

  // Call on document load
  document.addEventListener('DOMContentLoaded', () => {
    markActiveTheme();
  });
});

// Settings Tab Functionality - Media Testing
document.addEventListener('DOMContentLoaded', function() {
  // Camera Testing
  const startCameraButton = document.getElementById('start-camera');
  const stopCameraButton = document.getElementById('stop-camera');
  const cameraTest = document.getElementById('camera-test');
  let cameraStream = null;

  if (startCameraButton) {
    startCameraButton.addEventListener('click', async () => {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraTest.srcObject = cameraStream;
        startCameraButton.disabled = true;
        stopCameraButton.disabled = false;
      } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Could not access the camera. Please check your permissions.');
      }
    });
  }

  if (stopCameraButton) {
    stopCameraButton.addEventListener('click', () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraTest.srcObject = null;
        startCameraButton.disabled = false;
        stopCameraButton.disabled = true;
      }
    });
  }

  // Microphone Testing
  const startMicrophoneButton = document.getElementById('start-microphone');
  const stopMicrophoneButton = document.getElementById('stop-microphone');
  const micLevelBar = document.getElementById('mic-level-bar');
  let microphoneStream = null;
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let animationFrameId = null;

  if (startMicrophoneButton) {
    startMicrophoneButton.addEventListener('click', async () => {
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        function updateMicLevel() {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const level = (average / 128) * 100; // Scale to 0-100%
          micLevelBar.style.width = `${level}%`;
          animationFrameId = requestAnimationFrame(updateMicLevel);
        }

        updateMicLevel();
        startMicrophoneButton.disabled = true;
        stopMicrophoneButton.disabled = false;
      } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access the microphone. Please check your permissions.');
      }
    });
  }

  if (stopMicrophoneButton) {
    stopMicrophoneButton.addEventListener('click', () => {
      if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        if (audioContext) {
          audioContext.close();
        }
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        micLevelBar.style.width = '0';
        startMicrophoneButton.disabled = false;
        stopMicrophoneButton.disabled = true;
      }
    });
  }

  // Theme Selection
  const themeButtons = document.querySelectorAll('.theme-button');
  
  themeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const theme = button.dataset.theme;
      
      // Update the app's theme class directly
      const app = document.getElementById('app');
      app.className = `theme-${theme}`;
      
      // Update active state
      themeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Save preference
      fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme }),
      }).catch(error => {
        console.error('Error saving theme preference:', error);
      });
    });
  });
  
  // Initialize theme button state
  const currentTheme = appConfig.theme || 'light';
  const activeThemeButton = document.querySelector(`.theme-button[data-theme="${currentTheme}"]`);
  if (activeThemeButton) {
    activeThemeButton.classList.add('active');
  }
});

// Cooking Mode Functionality
document.addEventListener('DOMContentLoaded', function() {
  const startCookingButton = document.getElementById('start-cooking-mode');
  const cookingModeModal = document.getElementById('cooking-mode-modal');
  const cookingRecipeName = document.getElementById('cooking-recipe-name');
  const cookingRecipeImage = document.getElementById('cooking-recipe-image');
  const cookingStepsList = document.getElementById('cooking-steps-list');
  const currentStepNumber = document.getElementById('current-step-number');
  const currentStepInstructions = document.getElementById('current-step-instructions');
  const prevStepButton = document.getElementById('prev-step');
  const nextStepButton = document.getElementById('next-step');
  const startTimerButton = document.getElementById('start-timer');
  const timerDisplay = document.getElementById('timer-display');
  const voiceCommandIndicator = document.getElementById('voice-command-indicator');
  
  let currentRecipe = null;
  let currentStepIndex = 0;
  let cookingSteps = [];
  let timerInterval = null;
  let timerSeconds = 0;
  let recognition = null;
  
  if (startCookingButton) {
    startCookingButton.addEventListener('click', () => {
      const recipeId = document.getElementById('recipe-detail-content').dataset.recipeId;
      if (recipeId) {
        initCookingMode(recipeId);
      }
    });
  }
  
  async function initCookingMode(recipeId) {
    try {
      const response = await fetch('/api/recipes');
      const recipes = await response.json();
      currentRecipe = recipes.find(recipe => recipe.id === recipeId);
      
      if (currentRecipe) {
        cookingRecipeName.textContent = currentRecipe.name;
        cookingRecipeImage.src = currentRecipe.image;
        
        // Parse cooking steps from instructions
        cookingSteps = currentRecipe.instructions.split('\n').filter(step => step.trim() !== '');
        
        // Populate steps list
        cookingStepsList.innerHTML = '';
        cookingSteps.forEach((step, index) => {
          const li = document.createElement('li');
          li.className = 'step-item';
          if (index === 0) li.classList.add('active');
          li.dataset.step = index;
          li.textContent = step.replace(/^\d+\.\s*/, '').substring(0, 50) + '...';
          li.addEventListener('click', () => {
            goToStep(index);
          });
          cookingStepsList.appendChild(li);
        });
        
        // Set initial step
        currentStepIndex = 0;
        updateCurrentStep();
        
        // Initialize voice recognition if available
        initVoiceRecognition();
        
        // Show the modal
        cookingModeModal.classList.add('show');
      }
    } catch (error) {
      console.error('Error initializing cooking mode:', error);
    }
  }
  
  function updateCurrentStep() {
    const steps = cookingStepsList.querySelectorAll('.step-item');
    steps.forEach((step, index) => {
      if (index === currentStepIndex) {
        step.classList.add('active');
        step.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        step.classList.remove('active');
      }
    });
    
    currentStepNumber.textContent = currentStepIndex + 1;
    currentStepInstructions.textContent = cookingSteps[currentStepIndex].replace(/^\d+\.\s*/, '');
  }
  
  function goToStep(index) {
    if (index >= 0 && index < cookingSteps.length) {
      currentStepIndex = index;
      updateCurrentStep();
    }
  }
  
  if (prevStepButton) {
    prevStepButton.addEventListener('click', () => {
      if (currentStepIndex > 0) {
        currentStepIndex--;
        updateCurrentStep();
      }
    });
  }
  
  if (nextStepButton) {
    nextStepButton.addEventListener('click', () => {
      if (currentStepIndex < cookingSteps.length - 1) {
        currentStepIndex++;
        updateCurrentStep();
      }
    });
  }
  
  if (startTimerButton) {
    startTimerButton.addEventListener('click', () => {
      if (timerInterval) {
        // Stop timer
        clearInterval(timerInterval);
        timerInterval = null;
        startTimerButton.innerHTML = '<i class="fas fa-stopwatch"></i>';
      } else {
        // Start timer
        timerSeconds = 0;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
          timerSeconds++;
          updateTimerDisplay();
        }, 1000);
        startTimerButton.innerHTML = '<i class="fas fa-stop"></i>';
      }
    });
  }
  
  function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  function initVoiceRecognition() {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      
      recognition.onstart = () => {
        voiceCommandIndicator.classList.add('listening');
      };
      
      recognition.onend = () => {
        voiceCommandIndicator.classList.remove('listening');
        // Restart recognition
        if (cookingModeModal.classList.contains('show')) {
          recognition.start();
        }
      };
      
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        
        // Process voice commands
        if (transcript.includes('next') || transcript.includes('next step')) {
          if (currentStepIndex < cookingSteps.length - 1) {
            currentStepIndex++;
            updateCurrentStep();
          }
        } else if (transcript.includes('previous') || transcript.includes('back')) {
          if (currentStepIndex > 0) {
            currentStepIndex--;
            updateCurrentStep();
          }
        } else if (transcript.includes('start timer')) {
          if (!timerInterval) {
            timerSeconds = 0;
            updateTimerDisplay();
            timerInterval = setInterval(() => {
              timerSeconds++;
              updateTimerDisplay();
            }, 1000);
            startTimerButton.innerHTML = '<i class="fas fa-stop"></i>';
          }
        } else if (transcript.includes('stop timer')) {
          if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            startTimerButton.innerHTML = '<i class="fas fa-stopwatch"></i>';
          }
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        voiceCommandIndicator.classList.remove('listening');
      };
      
      // Start recognition
      try {
        recognition.start();
      } catch (e) {
        console.error('Error starting speech recognition:', e);
      }
      
      // Add event listener to stop recognition when modal is closed
      document.querySelector('#cooking-mode-modal .modal-close').addEventListener('click', () => {
        if (recognition) {
          recognition.stop();
        }
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
      });
    } else {
      console.warn('Speech recognition not supported in this browser');
      voiceCommandIndicator.style.display = 'none';
    }
  }
});

// Games Profile and Timer Functionality
document.addEventListener('DOMContentLoaded', function() {
  // Load user profiles for games
  const profileList = document.getElementById('profile-list');
  const playtimeMinutes = document.getElementById('playtime-minutes');
  const gameItems = document.querySelectorAll('.game-item');
  const gameTimerDisplay = document.getElementById('game-timer-display');
  const gameTimerUser = document.getElementById('game-timer-user');
  const gameTimerOverlay = document.getElementById('game-timer-overlay');
  const getModeGamesButton = document.getElementById('get-more-games-button');
  
  let selectedProfile = null;
  let gameTimerInterval = null;
  let remainingGameTime = 0;
  
  // Initially disable all game items until a profile is selected
  gameItems.forEach(item => {
    item.classList.add('disabled');
  });
  
  // Load user profiles
  async function loadUserProfiles() {
    try {
      const response = await fetch('/api/users');
      const users = await response.json();
      
      if (profileList) {
        profileList.innerHTML = '';
        
        if (!Array.isArray(users)) {
          console.error('Users data is not an array:', users);
          profileList.innerHTML = '<div class="error-message">Failed to load profiles</div>';
          return;
        }
        
        users.forEach(user => {
          const profileItem = document.createElement('div');
          profileItem.className = 'profile-item';
          profileItem.dataset.userId = user.id;
          profileItem.dataset.userName = user.name;
          
          // Get reward points for the user
          const rewardPoints = getRewardPointsForUser(user.name);
          // Calculate available playtime (5 minutes per 50 points)
          const availablePlaytime = Math.floor((rewardPoints / 50) * 5);
          profileItem.dataset.playtime = availablePlaytime;
          
          profileItem.innerHTML = `
            <div class="profile-avatar" style="background-color: ${user.color};">
              <i class="fas ${user.icon}"></i>
            </div>
            <div class="profile-name">${user.name}</div>
          `;
          
          profileItem.addEventListener('click', () => {
            selectProfile(profileItem);
          });
          
          profileList.appendChild(profileItem);
        });
      }
    } catch (error) {
      console.error('Error loading user profiles:', error);
    }
  }
  
  // Get reward points for a user from the rewards.json data
  function getRewardPointsForUser(userName) {
    // This would typically fetch from the server, but for now we'll use hardcoded values
    const rewardPoints = {
      'Alex': 125,
      'Jordan': 85,
      'Casey': 60,
      'Taylor': 45
    };
    
    return rewardPoints[userName] || 0;
  }
  
  // Select a profile
  function selectProfile(profileItem) {
    // Remove active class from all profiles
    const profiles = profileList.querySelectorAll('.profile-item');
    profiles.forEach(p => p.classList.remove('active'));
    
    // Add active class to selected profile
    profileItem.classList.add('active');
    
    // Update selected profile
    selectedProfile = {
      id: profileItem.dataset.userId,
      name: profileItem.dataset.userName,
      playtime: parseInt(profileItem.dataset.playtime || 0, 10)
    };
    
    // Update playtime display
    if (playtimeMinutes) {
      playtimeMinutes.textContent = selectedProfile.playtime;
    }
    
    // Enable game items now that a profile is selected
    gameItems.forEach(item => {
      item.classList.remove('disabled');
    });
    
    // Filter games based on profile
    filterGamesForProfile(selectedProfile);
  }
  
  // Filter games based on profile age/interests
  function filterGamesForProfile(profile) {
    if (!profile) return;
    
    // In a real implementation, this would filter based on age restrictions
    // or user preferences. For now, we'll just show/hide the play time.
    gameItems.forEach(item => {
      const playTimeIndicator = item.querySelector('.playtime-indicator');
      if (playTimeIndicator) {
        playTimeIndicator.style.display = 'block';
      }
    });
  }
  
  // Initialize game play
  gameItems.forEach(item => {
    item.addEventListener('click', () => {
      // Check if game is disabled (no profile selected)
      if (item.classList.contains('disabled')) {
        alert('Please select a profile first before playing games.');
        return;
      }
      
      if (!selectedProfile) {
        alert('Please select a profile first!');
        return;
      }
      
      const gameUrl = item.dataset.gameUrl;
      const gameTitle = item.querySelector('.game-title').textContent;
      const playTimeText = item.querySelector('.playtime-indicator').textContent;
      const playTimeMinutes = parseInt(playTimeText.replace(/[^0-9]/g, ''), 10);
      
      // Check if user has enough playtime
      if (selectedProfile.playtime < playTimeMinutes) {
        alert(`Not enough playtime available. ${selectedProfile.name} has ${selectedProfile.playtime} minutes, but this game requires ${playTimeMinutes} minutes.`);
        return;
      }
      
      // Set up the game iframe
      const gameIframe = document.getElementById('game-iframe');
      const gameModalTitle = document.getElementById('game-modal-title');
      
      if (gameIframe && gameModalTitle) {
        gameIframe.src = gameUrl;
        gameModalTitle.textContent = gameTitle;
        
        // Set up timer
        remainingGameTime = playTimeMinutes * 60; // Convert to seconds
        updateGameTimer();
        
        if (gameTimerInterval) {
          clearInterval(gameTimerInterval);
        }
        
        gameTimerInterval = setInterval(() => {
          remainingGameTime--;
          updateGameTimer();
          
          if (remainingGameTime <= 0) {
            endGame();
          }
        }, 1000);
        
        // Update timer overlay
        if (gameTimerOverlay) {
          gameTimerOverlay.style.display = 'flex';
        }
        
        if (gameTimerUser) {
          gameTimerUser.textContent = selectedProfile.name;
        }
        
        // Show game modal
        const gameModal = document.getElementById('game-focus-modal');
        if (gameModal) {
          gameModal.classList.add('show');
          
          // Add event listener to stop the timer when modal is closed
          const closeButton = gameModal.querySelector('.modal-close');
          if (closeButton) {
            closeButton.addEventListener('click', () => {
              endGame();
            });
          }
        }
      }
    });
  });
  
  // Update game timer display
  function updateGameTimer() {
    if (gameTimerDisplay) {
      const minutes = Math.floor(remainingGameTime / 60);
      const seconds = remainingGameTime % 60;
      gameTimerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Add visual indication when time is running low
      if (remainingGameTime <= 60) { // Last minute
        gameTimerDisplay.style.color = '#ff3860';
      } else {
        gameTimerDisplay.style.color = 'white';
      }
    }
  }
  
  // End game session
  function endGame() {
    if (gameTimerInterval) {
      clearInterval(gameTimerInterval);
      gameTimerInterval = null;
    }
    
    // Update user's remaining playtime
    if (selectedProfile) {
      const playedMinutes = Math.ceil((playTimeMinutes * 60 - remainingGameTime) / 60);
      selectedProfile.playtime -= playedMinutes;
      if (selectedProfile.playtime < 0) selectedProfile.playtime = 0;
      
      // Update display
      if (playtimeMinutes) {
        playtimeMinutes.textContent = selectedProfile.playtime;
      }
      
      // Update the profile item
      const profileItem = profileList.querySelector(`.profile-item[data-user-id="${selectedProfile.id}"]`);
      if (profileItem) {
        profileItem.dataset.playtime = selectedProfile.playtime;
      }
    }
    
    // Clear game iframe
    const gameIframe = document.getElementById('game-iframe');
    if (gameIframe) {
      gameIframe.src = '';
    }
    
    // Hide game modal (if it's not already being closed)
    const gameModal = document.getElementById('game-focus-modal');
    if (gameModal && gameModal.classList.contains('show')) {
      gameModal.classList.remove('show');
    }
  }
  
  // Initialize Community Games Modal
  if (getModeGamesButton) {
    getModeGamesButton.addEventListener('click', () => {
      const modal = document.getElementById('get-more-games-modal');
      if (modal) {
        modal.classList.add('show');
      }
    });
  }
  
  // Handle community game installation
  const installButtons = document.querySelectorAll('.install-game-btn');
  installButtons.forEach(button => {
    button.addEventListener('click', () => {
      const gameItem = button.closest('.community-game-item');
      const gameTitle = gameItem.querySelector('h4').textContent;
      
      // Simulate installation
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing...';
      
      setTimeout(() => {
        button.innerHTML = '<i class="fas fa-check"></i> Installed';
        button.disabled = true;
        
        alert(`${gameTitle} has been installed and added to your games library!`);
      }, 2000);
    });
  });
  
  // Initialize profiles on load
  loadUserProfiles();
});

// Meal Categories Functionality
document.addEventListener('DOMContentLoaded', function() {
  const addCategoryButton = document.getElementById('add-category');
  const categoriesContainer = document.getElementById('meal-categories-container');
  
  if (addCategoryButton && categoriesContainer) {
    addCategoryButton.addEventListener('click', () => {
      const categoryName = prompt('Enter new category name:');
      if (categoryName && categoryName.trim()) {
        addNewCategory(categoryName.trim());
      }
    });
  }
  
  async function addNewCategory(categoryName) {
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll update the DOM directly
      const newCategory = {
        id: Date.now().toString(),
        name: categoryName,
        color: getRandomColor(),
        icon: 'fa-utensils'
      };
      
      // Add to UI
      appendCategoryToUI(newCategory);
      
      // Refresh the meal type dropdown
      const mealTypeSelect = document.getElementById('mealType');
      if (mealTypeSelect) {
        const option = document.createElement('option');
        option.value = newCategory.name;
        option.textContent = newCategory.name;
        mealTypeSelect.appendChild(option);
      }
      
      // Simulate saving to server
      console.log('New category added:', newCategory);
    } catch (error) {
      console.error('Error adding category:', error);
    }
  }
  
  // Function to append a category to the UI
  function appendCategoryToUI(category) {
    if (!categoriesContainer) return;
    
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    categoryItem.dataset.id = category.id;
    
    categoryItem.innerHTML = `
      <div class="category-wrap">
        <div class="sortable-handle">
          <i class="fas fa-grip-lines"></i>
        </div>
        <div class="category-color" style="background-color: ${category.color}">
          <i class="fas ${category.icon}"></i>
        </div>
        <div class="category-name">
          <span>${category.name}</span>
        </div>
        <div class="category-actions">
          <button class="btn-icon category-edit" title="Edit Category">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button class="btn-icon category-delete" title="Delete Category">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    `;
    
    categoriesContainer.appendChild(categoryItem);
    
    // Add event listeners to the new buttons
    const editButton = categoryItem.querySelector('.category-edit');
    if (editButton) {
      editButton.addEventListener('click', () => {
        const categoryName = categoryItem.querySelector('.category-name span').textContent;
        const newName = prompt('Edit category name:', categoryName);
        if (newName && newName.trim() !== '' && newName !== categoryName) {
          categoryItem.querySelector('.category-name span').textContent = newName;
          
          // Update category on server
          updateCategory(category.id, { name: newName });
        }
      });
    }
    
    const deleteButton = categoryItem.querySelector('.category-delete');
    if (deleteButton) {
      deleteButton.addEventListener('click', () => {
        if (confirm(`Delete the category "${category.name}"?`)) {
          // Delete category from server
          deleteCategory(category.id);
          categoryItem.remove();
        }
      });
    }
  }
  
  // Function to update a category
  async function updateCategory(id, data) {
    try {
      const response = await fetch(`/api/meal-categories/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Refresh the meal type dropdown
      populateMealTypeDropdown();
      
      // Refresh the meal plan
      fetchAndDisplayMeals();
      
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category');
    }
  }
  
  // Function to delete a category
  async function deleteCategory(id) {
    try {
      const response = await fetch(`/api/meal-categories/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Refresh the meal type dropdown
      populateMealTypeDropdown();
      
      // Refresh the meal plan
      fetchAndDisplayMeals();
      
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    }
  }
  
  function getRandomColor() {
    const colors = ['#4285f4', '#34a853', '#fbbc05', '#ea4335', '#9c27b0', '#009688'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  // Load existing categories
  async function loadCategories() {
    try {
      const response = await fetch('/api/meal-categories');
      const categories = await response.json();
      
      if (categoriesContainer) {
        categoriesContainer.innerHTML = '';
        categories.forEach(category => {
          appendCategoryToUI(category);
        });
      }
    } catch (error) {
      console.error('Error loading meal categories:', error);
    }
  }
  
  // Initialize Sortable.js for drag-and-drop reordering
  if (categoriesContainer) {
    new Sortable(categoriesContainer, {
      handle: '.sortable-handle',
      animation: 150,
      onEnd: function() {
        // TODO: Save new order to server
        console.log('Categories reordered');
      }
    });
  }
  
  // Load categories on page load
  loadCategories();
});

// Function to get weather for a specific date
// This is a placeholder - in a real implementation this would fetch from an API or local storage
function getWeatherForDate(dateKey) {
  // For demo purposes, generate some random weather
  const weather = {
    'sunny': { temp: [60, 85], condition: 'sunny' },
    'cloudy': { temp: [55, 75], condition: 'cloudy' },
    'rainy': { temp: [50, 70], condition: 'rainy' },
    'stormy': { temp: [45, 65], condition: 'stormy' },
    'snowy': { temp: [25, 35], condition: 'snowy' }
  };
  
  // Use hash of date to get consistent but "random-looking" weather
  const hash = dateKey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const conditions = Object.keys(weather);
  const condition = conditions[Math.abs(hash) % conditions.length];
  
  const tempRange = weather[condition].temp;
  const temp = tempRange[0] + (Math.abs(hash) % (tempRange[1] - tempRange[0]));
  
  return {
    temp: temp,
    condition: weather[condition].condition
  };
}

// ===== Screen Burn Protection & Night Mode =====
let activityTimeout;
let displaySettings = {
  autoNightMode: true,
  nightModeStart: "20:00",
  nightModeEnd: "07:00",
  screenBurnProtection: true,
  dimAfterMinutes: 10,
  displayClock: false
};

// Load display settings on startup
function loadDisplaySettings() {
  fetch('/api/display-settings')
    .then(response => response.json())
    .then(settings => {
      displaySettings = settings;
      
      // Apply saved settings to UI controls
      document.getElementById('auto-night-mode').checked = settings.autoNightMode;
      document.getElementById('night-mode-start').value = settings.nightModeStart;
      document.getElementById('night-mode-end').value = settings.nightModeEnd;
      document.getElementById('screen-burn-protection').checked = settings.screenBurnProtection;
      document.getElementById('dim-after-minutes').value = settings.dimAfterMinutes;
      document.getElementById('display-clock').checked = settings.displayClock;
      
      // Apply settings immediately
      applyNightModeIfNeeded();
      resetActivityTimer();
      updateClockDisplay();
    })
    .catch(error => console.error('Error loading display settings:', error));
}

// Save display settings when changed
function saveDisplaySettings() {
  const settings = {
    autoNightMode: document.getElementById('auto-night-mode').checked,
    nightModeStart: document.getElementById('night-mode-start').value,
    nightModeEnd: document.getElementById('night-mode-end').value,
    screenBurnProtection: document.getElementById('screen-burn-protection').checked,
    dimAfterMinutes: parseInt(document.getElementById('dim-after-minutes').value),
    displayClock: document.getElementById('display-clock').checked
  };
  
  fetch('/api/display-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  })
    .then(response => response.json())
    .then(updatedSettings => {
      displaySettings = updatedSettings;
      console.log('Display settings saved:', updatedSettings);
      
      // Apply new settings
      applyNightModeIfNeeded();
      resetActivityTimer();
      updateClockDisplay();
    })
    .catch(error => console.error('Error saving display settings:', error));
}

// Track user activity to reset screen dimming timer
function resetActivityTimer() {
  clearTimeout(activityTimeout);
  
  // If screen is currently dimmed, wake it up
  if (document.getElementById('screen-dimmer').classList.contains('active')) {
    wakeScreen();
  }
  
  // Only set a new timeout if screen burn protection is enabled
  if (displaySettings.screenBurnProtection) {
    const dimAfterMs = displaySettings.dimAfterMinutes * 60 * 1000;
    activityTimeout = setTimeout(dimScreen, dimAfterMs);
  }
}

// Dim the screen after inactivity
function dimScreen() {
  const dimmer = document.getElementById('screen-dimmer');
  dimmer.classList.add('active');
  
  // Start countdown timer
  let countdown = 30;
  const countdownElement = document.getElementById('dimmer-countdown');
  countdownElement.textContent = countdown;
  
  const countdownInterval = setInterval(() => {
    countdown--;
    countdownElement.textContent = countdown;
    
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      wakeScreen();
    }
  }, 1000);
  
  // Store the interval ID on the dimmer element to clear it when waking up manually
  dimmer.dataset.countdownInterval = countdownInterval;
}

// Wake up the screen
function wakeScreen() {
  const dimmer = document.getElementById('screen-dimmer');
  dimmer.classList.remove('active');
  
  // Clear any running countdown
  if (dimmer.dataset.countdownInterval) {
    clearInterval(parseInt(dimmer.dataset.countdownInterval));
  }
  
  // Reset the activity timer
  resetActivityTimer();
}

// Check if night mode should be applied based on current time
function applyNightModeIfNeeded() {
  if (!displaySettings.autoNightMode) {
    // Remove night mode if it was previously applied
    document.getElementById('app').classList.remove('theme-night');
    return;
  }
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  // Parse start and end times to minutes
  const [startHours, startMinutes] = displaySettings.nightModeStart.split(':').map(Number);
  const [endHours, endMinutes] = displaySettings.nightModeEnd.split(':').map(Number);
  
  const nightModeStartMinutes = startHours * 60 + startMinutes;
  const nightModeEndMinutes = endHours * 60 + endMinutes;
  
  // Determine if night mode should be active
  let shouldApplyNightMode = false;
  
  // If night mode crosses midnight
  if (nightModeStartMinutes > nightModeEndMinutes) {
    shouldApplyNightMode = currentTime >= nightModeStartMinutes || currentTime < nightModeEndMinutes;
  } else {
    shouldApplyNightMode = currentTime >= nightModeStartMinutes && currentTime < nightModeEndMinutes;
  }
  
  // Apply or remove night mode
  if (shouldApplyNightMode) {
    document.getElementById('app').classList.add('theme-night');
  } else {
    document.getElementById('app').classList.remove('theme-night');
  }
}

// Update persistent clock display
function updateClockDisplay() {
  const clockDisplay = document.getElementById('clock-display');
  
  if (displaySettings.displayClock) {
    clockDisplay.style.display = 'block';
    updateClockTime();
    
    // Update clock every minute
    setInterval(updateClockTime, 60000);
  } else {
    clockDisplay.style.display = 'none';
  }
}

// Update the clock time
function updateClockTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  
  // Format time as 12-hour with AM/PM
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
  const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
  
  document.getElementById('clock-display').textContent = `${displayHours}:${displayMinutes} ${ampm}`;
}

// Initialize screen burn protection and night mode
document.addEventListener('DOMContentLoaded', () => {
  // Load settings
  loadDisplaySettings();
  
  // Set up event listeners for user activity
  ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'].forEach(event => {
    document.addEventListener(event, resetActivityTimer);
  });
  
  // Set up Dimmer dismiss button
  document.getElementById('dimmer-dismiss').addEventListener('click', wakeScreen);
  
  // Set up settings form event listeners
  document.getElementById('auto-night-mode').addEventListener('change', saveDisplaySettings);
  document.getElementById('night-mode-start').addEventListener('change', saveDisplaySettings);
  document.getElementById('night-mode-end').addEventListener('change', saveDisplaySettings);
  document.getElementById('screen-burn-protection').addEventListener('change', saveDisplaySettings);
  document.getElementById('dim-after-minutes').addEventListener('change', saveDisplaySettings);
  document.getElementById('display-clock').addEventListener('change', saveDisplaySettings);
  
  // Apply initial night mode if needed
  applyNightModeIfNeeded();
  
  // Start a timer to check night mode every minute
  setInterval(applyNightModeIfNeeded, 60000);
  
  // Initialize screen activity timer
  resetActivityTimer();
});