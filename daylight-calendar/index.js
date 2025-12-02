// Daylight Calendar v1.1.7.2-alpha-11
// A beautiful fullscreen calendar display for Home Assistant
// Copyright (c) 2024

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');

// Configuration
let config;
const localOptionsPath = path.join(__dirname, 'options.json');
const supervisorOptionsPath = '/data/options.json';
const isProduction = process.env.SUPERVISOR_TOKEN !== undefined;

try {
  config = JSON.parse(fs.readFileSync(supervisorOptionsPath, 'utf8'));
  console.log(`Loaded configuration from ${supervisorOptionsPath}`);
} catch (error) {
  console.warn(`Could not read ${supervisorOptionsPath}. This is normal if running locally or if HA Supervisor has not provided it yet.`);
  try {
    config = JSON.parse(fs.readFileSync(localOptionsPath, 'utf8'));
    console.log(`Loaded local fallback configuration from ${localOptionsPath}`);
  } catch (localError) {
    console.error(`Failed to load local fallback configuration from ${localOptionsPath}:`, localError);
    config = { theme: "light", show_weather: true, locale: "en-US", time_format: "12h", kiosk_mode: false };
    console.log("Using hardcoded default configuration for debugging.");
  }
}

const PORT = process.env.PORT || 8099;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Home Assistant API connection setup
const hassApiUrl = isProduction 
  ? 'http://supervisor/core/api' 
  : process.env.HASS_API_URL || 'http://localhost:8123/api';

const supervisorToken = process.env.SUPERVISOR_TOKEN || process.env.HASS_TOKEN;

// Log auth setup for debugging (only log presence, not actual token)
console.log('[INFO] Authentication setup:');
console.log(`[INFO] - Production mode: ${isProduction}`);
console.log(`[INFO] - API URL: ${hassApiUrl}`);
console.log(`[INFO] - Token present: ${!!supervisorToken}`);
console.log(`[INFO] - Token length: ${supervisorToken ? supervisorToken.length : 0}`);

const hassHeaders = {
  Authorization: `Bearer ${supervisorToken}`,
  'Content-Type': 'application/json',
};

// Data directories setup
const dataDir = isProduction ? '/data' : path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`Created data directory at ${dataDir}`);
}

// Helper function to get data file path
const getDataPath = (filename) => {
  return path.join(dataDir, filename);
};

// Helper function to initialize data files with defaults if they don't exist
const initializeDataFile = (filename, defaultData) => {
  const filePath = getDataPath(filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    console.log(`Initialized ${filename} with default data`);
  }
};

// Initialize default data files for all environments
// These files are required for the app to function properly
initializeDataFile('chores.json', []);

// Default users - needed for calendar display and chore assignment
initializeDataFile('users.json', [
  {
    id: "dev-1",
    name: "Developer",
    color: "#4285f4",
    icon: "fa-user"
  }
]);

// Default meal categories
initializeDataFile('meal-categories.json', [
  {
    id: "1",
    name: "Breakfast",
    color: "#4285f4",
    icon: "fa-coffee"
  },
  {
    id: "2",
    name: "Lunch",
    color: "#34a853",
    icon: "fa-hamburger"
  },
  {
    id: "3",
    name: "Dinner", 
    color: "#fbbc05",
    icon: "fa-utensils"
  }
]);

// Initialize other required data files
initializeDataFile('meals.json', []);
initializeDataFile('recipes.json', []);
initializeDataFile('grocery-list.json', []);

// Initialize display settings with defaults
initializeDataFile('display-settings.json', {
  autoNightMode: true,
  nightModeStart: "20:00",
  nightModeEnd: "07:00",
  screenBurnProtection: true,
  dimAfterMinutes: 10,
  displayClock: false
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/config', (req, res) => {
  res.json(config);
});

// Generic data file handler function
const handleDataFile = (filename, fallbackFile) => {
  return (req, res) => {
    const filePath = getDataPath(filename);
    const fallbackPath = path.join(__dirname, 'public', fallbackFile || filename);
    
    // In production, always use the data directory file
    // In development, fallback to the public directory file if needed
    const resolvedPath = fs.existsSync(filePath) ? filePath : 
                        (!isProduction && fs.existsSync(fallbackPath)) ? fallbackPath : filePath;
    
    fs.readFile(resolvedPath, 'utf8', (err, data) => {
      if (err) {
        console.error(`[ERROR] Error reading ${filename}:`, err);
        console.log(`[INFO] Returning empty array for ${filename}`);
        // Return empty array instead of error for missing files
        return res.json([]);
      }
      try {
        const jsonData = JSON.parse(data);
        res.json(jsonData);
      } catch (parseError) {
        console.error(`[ERROR] Error parsing ${filename}:`, parseError);
        console.log(`[INFO] Returning empty array for ${filename} due to parse error`);
        // Return empty array instead of error for malformed files
        return res.json([]);
      }
    });
  };
};

// Helper function to write data to a file
const writeDataFile = (filename, data, res, successCallback) => {
  const filePath = getDataPath(filename);
  fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error(`[ERROR] Error writing ${filename}:`, err);
      return res.status(500).json({ error: `Failed to save ${filename.replace('.json', '')} data` });
    }
    successCallback();
  });
};

// GET endpoint for chores
app.get('/api/chores', handleDataFile('chores.json'));

// POST endpoint to add a new chore
app.post('/api/chores', (req, res) => {
  const filePath = getDataPath('chores.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err && !fs.existsSync(path.dirname(filePath))) {
      // If directory doesn't exist, create it
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      data = '[]'; // Initialize with empty array
    } else if (err) {
      console.error('[ERROR] Error reading chores.json for POST:', err);
      return res.status(500).json({ error: 'Failed to read chores data' });
    }
    
    try {
      const chores = err ? [] : JSON.parse(data);
      const newChore = {
        id: Date.now().toString(),
        name: req.body.name,
        assigneeName: req.body.assigneeName,
        dueDate: req.body.dueDate,
        completed: false,
        rewardPoints: req.body.rewardPoints || 10 // Default to 10 points if not specified
      };
      chores.push(newChore);
      
      writeDataFile('chores.json', chores, res, () => {
        res.status(201).json(newChore);
      });
    } catch (parseErr) {
      console.error('[ERROR] Error parsing chores.json:', parseErr);
      res.status(500).json({ error: 'Invalid chores data format' });
    }
  });
});

// DELETE endpoint to remove a chore
app.delete('/api/chores/:id', (req, res) => {
  const filePath = getDataPath('chores.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[ERROR] Error reading chores.json for DELETE:', err);
      return res.status(500).json({ error: 'Failed to read chores data' });
    }
    try {
      let chores = JSON.parse(data);
      const originalLength = chores.length;
      chores = chores.filter(chore => chore.id !== req.params.id);
      
      if (chores.length === originalLength) {
        return res.status(404).json({ error: 'Chore not found' });
      }
      
      writeDataFile('chores.json', chores, res, () => {
        res.status(200).json({ message: 'Chore deleted successfully' });
      });
    } catch (err) {
      console.error('[ERROR] Error parsing chores.json:', err);
      res.status(500).json({ error: 'Invalid chores data format' });
    }
  });
});

// PATCH endpoint to update a chore
app.patch('/api/chores/:id', (req, res) => {
  const filePath = getDataPath('chores.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[ERROR] Error reading chores.json for PATCH:', err);
      return res.status(500).json({ error: 'Failed to read chores data' });
    }
    try {
      let chores = JSON.parse(data);
      const choreIndex = chores.findIndex(chore => chore.id === req.params.id);
      
      if (choreIndex === -1) {
        return res.status(404).json({ error: 'Chore not found' });
      }
      
      // Update the chore with the provided fields
      chores[choreIndex] = { ...chores[choreIndex], ...req.body };
      
      writeDataFile('chores.json', chores, res, () => {
        res.status(200).json(chores[choreIndex]);
      });
    } catch (err) {
      console.error('[ERROR] Error parsing chores.json:', err);
      res.status(500).json({ error: 'Invalid chores data format' });
    }
  });
});

// GET endpoint for users
app.get('/api/users', handleDataFile('users.json'));

// POST endpoint to add a new user
app.post('/api/users', (req, res) => {
  const filePath = getDataPath('users.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err && !fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      data = '[]';
    } else if (err) {
      console.error('[ERROR] Error reading users.json for POST:', err);
      return res.status(500).json({ error: 'Failed to read users data' });
    }
    
    try {
      const users = err ? [] : JSON.parse(data);
      const newUser = {
        id: Date.now().toString(),
        name: req.body.name,
        color: req.body.color || '#4285f4',
        icon: req.body.icon || 'fa-user',
        photo: req.body.photo || null,
        gameTimeLimit: req.body.gameTimeLimit || 30
      };
      users.push(newUser);
      
      writeDataFile('users.json', users, res, () => {
        res.status(201).json(newUser);
      });
    } catch (parseErr) {
      console.error('[ERROR] Error parsing users.json:', parseErr);
      res.status(500).json({ error: 'Invalid users data format' });
    }
  });
});

// PUT endpoint to update a user
app.put('/api/users/:id', (req, res) => {
  const filePath = getDataPath('users.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[ERROR] Error reading users.json for PUT:', err);
      return res.status(500).json({ error: 'Failed to read users data' });
    }
    try {
      let users = JSON.parse(data);
      const userIndex = users.findIndex(user => user.id === req.params.id);
      
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      users[userIndex] = { ...users[userIndex], ...req.body };
      
      writeDataFile('users.json', users, res, () => {
        res.status(200).json(users[userIndex]);
      });
    } catch (err) {
      console.error('[ERROR] Error parsing users.json:', err);
      res.status(500).json({ error: 'Invalid users data format' });
    }
  });
});

// DELETE endpoint to remove a user
app.delete('/api/users/:id', (req, res) => {
  const filePath = getDataPath('users.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[ERROR] Error reading users.json for DELETE:', err);
      return res.status(500).json({ error: 'Failed to read users data' });
    }
    try {
      let users = JSON.parse(data);
      const originalLength = users.length;
      users = users.filter(user => user.id !== req.params.id);
      
      if (users.length === originalLength) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      writeDataFile('users.json', users, res, () => {
        res.status(200).json({ message: 'User deleted successfully' });
      });
    } catch (err) {
      console.error('[ERROR] Error parsing users.json:', err);
      res.status(500).json({ error: 'Invalid users data format' });
    }
  });
});

// GET endpoint for meal categories
app.get('/api/meal-categories', handleDataFile('meal-categories.json'));

// POST endpoint to add a new meal category
app.post('/api/meal-categories', (req, res) => {
  const filePath = getDataPath('meal-categories.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err && !fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      data = '[]';
    } else if (err) {
      console.error('[ERROR] Error reading meal-categories.json for POST:', err);
      return res.status(500).json({ error: 'Failed to read meal categories data' });
    }
    
    try {
      const categories = err ? [] : JSON.parse(data);
      const newCategory = {
        id: Date.now().toString(),
        name: req.body.name,
        color: req.body.color || '#4285f4',
        icon: req.body.icon || 'fa-utensils'
      };
      categories.push(newCategory);
      
      writeDataFile('meal-categories.json', categories, res, () => {
        res.status(201).json(newCategory);
      });
    } catch (parseErr) {
      console.error('[ERROR] Error parsing meal-categories.json:', parseErr);
      res.status(500).json({ error: 'Invalid meal categories data format' });
    }
  });
});

// PUT endpoint to update a meal category
app.put('/api/meal-categories/:id', (req, res) => {
  const filePath = getDataPath('meal-categories.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[ERROR] Error reading meal-categories.json for PUT:', err);
      return res.status(500).json({ error: 'Failed to read meal categories data' });
    }
    try {
      let categories = JSON.parse(data);
      const categoryIndex = categories.findIndex(cat => cat.id === req.params.id);
      
      if (categoryIndex === -1) {
        return res.status(404).json({ error: 'Meal category not found' });
      }
      
      categories[categoryIndex] = { ...categories[categoryIndex], ...req.body };
      
      writeDataFile('meal-categories.json', categories, res, () => {
        res.status(200).json(categories[categoryIndex]);
      });
    } catch (err) {
      console.error('[ERROR] Error parsing meal-categories.json:', err);
      res.status(500).json({ error: 'Invalid meal categories data format' });
    }
  });
});

// DELETE endpoint to remove a meal category
app.delete('/api/meal-categories/:id', (req, res) => {
  const filePath = getDataPath('meal-categories.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[ERROR] Error reading meal-categories.json for DELETE:', err);
      return res.status(500).json({ error: 'Failed to read meal categories data' });
    }
    try {
      let categories = JSON.parse(data);
      const originalLength = categories.length;
      categories = categories.filter(cat => cat.id !== req.params.id);
      
      if (categories.length === originalLength) {
        return res.status(404).json({ error: 'Meal category not found' });
      }
      
      writeDataFile('meal-categories.json', categories, res, () => {
        res.status(200).json({ message: 'Meal category deleted successfully' });
      });
    } catch (err) {
      console.error('[ERROR] Error parsing meal-categories.json:', err);
      res.status(500).json({ error: 'Invalid meal categories data format' });
    }
  });
});

// GET endpoint for meals
app.get('/api/meals', handleDataFile('meals.json'));

// POST endpoint to add a new meal
app.post('/api/meals', (req, res) => {
  const filePath = getDataPath('meals.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err && !fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      data = '[]';
    } else if (err) {
      console.error('[ERROR] Error reading meals.json for POST:', err);
      return res.status(500).json({ error: 'Failed to read meals data' });
    }
    
    try {
      const meals = err ? [] : JSON.parse(data);
      const newMeal = {
        id: Date.now().toString(),
        description: req.body.description,
        type: req.body.type,
        date: req.body.date,
        cook: req.body.cook || '',
        recipeId: req.body.recipeId || null
      };
      meals.push(newMeal);
      
      writeDataFile('meals.json', meals, res, () => {
        res.status(201).json(newMeal);
      });
    } catch (parseErr) {
      console.error('[ERROR] Error parsing meals.json:', parseErr);
      res.status(500).json({ error: 'Invalid meals data format' });
    }
  });
});

// DELETE endpoint to remove a meal
app.delete('/api/meals/:id', (req, res) => {
  const filePath = getDataPath('meals.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[ERROR] Error reading meals.json for DELETE:', err);
      return res.status(500).json({ error: 'Failed to read meals data' });
    }
    try {
      let meals = JSON.parse(data);
      const originalLength = meals.length;
      meals = meals.filter(meal => meal.id !== req.params.id);
      
      if (meals.length === originalLength) {
        return res.status(404).json({ error: 'Meal not found' });
      }
      
      writeDataFile('meals.json', meals, res, () => {
        res.status(200).json({ message: 'Meal deleted successfully' });
      });
    } catch (err) {
      console.error('[ERROR] Error parsing meals.json:', err);
      res.status(500).json({ error: 'Invalid meals data format' });
    }
  });
});

// GET endpoint for recipes
app.get('/api/recipes', handleDataFile('recipes.json'));

// GET endpoint for a single recipe by ID
app.get('/api/recipes/:id', (req, res) => {
  const filePath = getDataPath('recipes.json');
  const fallbackPath = path.join(__dirname, 'public', 'recipes.json');
  
  const resolvedPath = fs.existsSync(filePath) ? filePath : 
                      (!isProduction && fs.existsSync(fallbackPath)) ? fallbackPath : filePath;
  
  fs.readFile(resolvedPath, 'utf8', (err, data) => {
    if (err) {
      console.error(`[ERROR] Error reading recipes.json:`, err);
      return res.status(500).json({ error: 'Failed to load recipe data' });
    }
    
    try {
      const recipes = JSON.parse(data);
      const recipe = recipes.find(r => r.id === req.params.id);
      
      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      
      res.json(recipe);
    } catch (parseError) {
      console.error(`[ERROR] Error parsing recipes.json:`, parseError);
      res.status(500).json({ error: 'Failed to parse recipe data' });
    }
  });
});

// GET endpoint for grocery list
app.get('/api/grocery-list', handleDataFile('grocery-list.json'));

// POST endpoint to add a grocery item
app.post('/api/grocery-list', (req, res) => {
  const filePath = getDataPath('grocery-list.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err && !fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      data = '[]';
    } else if (err) {
      console.error('[ERROR] Error reading grocery-list.json for POST:', err);
      return res.status(500).json({ error: 'Failed to read grocery list data' });
    }
    
    try {
      const items = err ? [] : JSON.parse(data);
      const newItem = {
        id: Date.now().toString(),
        name: req.body.name,
        quantity: req.body.quantity || '',
        checked: false
      };
      items.push(newItem);
      
      writeDataFile('grocery-list.json', items, res, () => {
        res.status(201).json(newItem);
      });
    } catch (parseErr) {
      console.error('[ERROR] Error parsing grocery-list.json:', parseErr);
      res.status(500).json({ error: 'Invalid grocery list data format' });
    }
  });
});

// PATCH endpoint to update a grocery item
app.patch('/api/grocery-list/:id', (req, res) => {
  const filePath = getDataPath('grocery-list.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[ERROR] Error reading grocery-list.json for PATCH:', err);
      return res.status(500).json({ error: 'Failed to read grocery list data' });
    }
    try {
      let items = JSON.parse(data);
      const itemIndex = items.findIndex(item => item.id === req.params.id);
      
      if (itemIndex === -1) {
        return res.status(404).json({ error: 'Grocery item not found' });
      }
      
      items[itemIndex] = { ...items[itemIndex], ...req.body };
      
      writeDataFile('grocery-list.json', items, res, () => {
        res.status(200).json(items[itemIndex]);
      });
    } catch (err) {
      console.error('[ERROR] Error parsing grocery-list.json:', err);
      res.status(500).json({ error: 'Invalid grocery list data format' });
    }
  });
});

// DELETE endpoint to remove a grocery item
app.delete('/api/grocery-list/:id', (req, res) => {
  const filePath = getDataPath('grocery-list.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('[ERROR] Error reading grocery-list.json for DELETE:', err);
      return res.status(500).json({ error: 'Failed to read grocery list data' });
    }
    try {
      let items = JSON.parse(data);
      const originalLength = items.length;
      items = items.filter(item => item.id !== req.params.id);
      
      if (items.length === originalLength) {
        return res.status(404).json({ error: 'Grocery item not found' });
      }
      
      writeDataFile('grocery-list.json', items, res, () => {
        res.status(200).json({ message: 'Grocery item deleted successfully' });
      });
    } catch (err) {
      console.error('[ERROR] Error parsing grocery-list.json:', err);
      res.status(500).json({ error: 'Invalid grocery list data format' });
    }
  });
});

// GET endpoint for display settings
app.get('/api/display-settings', (req, res) => {
  const filePath = getDataPath('display-settings.json');
  
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      res.json(JSON.parse(data));
    } else {
      // Default settings if file doesn't exist
      const defaultSettings = {
        autoNightMode: true,
        nightModeStart: "20:00",
        nightModeEnd: "07:00",
        screenBurnProtection: true,
        dimAfterMinutes: 10,
        displayClock: false
      };
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }
      
      // Write default settings to file
      fs.writeFileSync(filePath, JSON.stringify(defaultSettings, null, 2));
      res.json(defaultSettings);
    }
  } catch (error) {
    console.error('[ERROR] Error processing display settings:', error);
    res.status(500).json({ error: 'Failed to process display settings' });
  }
});

// Update display settings
app.post('/api/display-settings', (req, res) => {
  const filePath = getDataPath('display-settings.json');
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    
    // Validate and sanitize settings
    const settings = {
      autoNightMode: !!req.body.autoNightMode,
      nightModeStart: req.body.nightModeStart || "20:00",
      nightModeEnd: req.body.nightModeEnd || "07:00",
      screenBurnProtection: !!req.body.screenBurnProtection,
      dimAfterMinutes: Math.max(1, Math.min(60, parseInt(req.body.dimAfterMinutes) || 10)),
      displayClock: !!req.body.displayClock
    };
    
    // Write settings to file
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
    
    // Broadcast settings update to all clients
    io.emit('display_settings_update', settings);
    
    res.json(settings);
  } catch (error) {
    console.error('[ERROR] Error saving display settings:', error);
    res.status(500).json({ error: 'Failed to save display settings' });
  }
});

// Re-enable API routes with proper error handling that depend on Home Assistant
app.get('/api/calendar', async (req, res) => {
  // Check if we have authentication
  if (!supervisorToken) {
    console.error('[ERROR] No authentication token available for calendar API');
    return res.status(500).json({ 
      error: 'Authentication not configured', 
      details: 'SUPERVISOR_TOKEN or HASS_TOKEN environment variable not set'
    });
  }
  
  try {
    console.log(`[INFO] Fetching calendar data from: ${hassApiUrl}/calendars`);
    console.log(`[INFO] Using token: ${supervisorToken.substring(0, 10)}...`);
    const response = await axios.get(`${hassApiUrl}/calendars`, { 
      headers: hassHeaders,
      timeout: 10000 // 10 second timeout
    });
    
    if (response.status === 200) {
      res.json(response.data);
    } else {
      console.error(`[ERROR] Calendar API returned status: ${response.status}`);
      res.status(response.status).json({ 
        error: 'Failed to fetch calendar data', 
        statusCode: response.status
      });
    }
  } catch (error) {
    console.error('[ERROR] Error fetching calendar data:', error.message);
    
    if (error.response) {
      console.error('[ERROR] Calendar API Response Status:', error.response.status);
      console.error('[ERROR] Calendar API Response Data:', error.response.data);
      
      res.status(error.response.status).json({ 
        error: 'Failed to fetch calendar data', 
        details: error.response.data,
        statusCode: error.response.status
      });
    } else if (error.request) {
      console.error('[ERROR] No response received from calendar API');
      res.status(500).json({ 
        error: 'No response received from Home Assistant calendar API', 
        details: 'Request was made but no response was received'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch calendar data', 
        details: error.message
      });
    }
  }
});

app.get('/api/weather', async (req, res) => {
  if (!config || !config.show_weather) {
    console.log('[INFO] Weather display is disabled in config.');
    return res.json({ enabled: false });
  }
  
  // Check if we have authentication
  if (!supervisorToken) {
    console.error('[ERROR] No authentication token available for weather API');
    return res.status(500).json({ 
      error: 'Authentication not configured', 
      details: 'SUPERVISOR_TOKEN or HASS_TOKEN environment variable not set'
    });
  }
  
  try {
    // Use configured entity or default to weather.forecast_home
    const weatherEntity = config.weather_entity || 'weather.forecast_home';
    console.log(`[INFO] Fetching weather data for entity: ${weatherEntity}`);
    
    const response = await axios.get(`${hassApiUrl}/states/${weatherEntity}`, { 
      headers: hassHeaders,
      timeout: 10000 // 10 second timeout
    });
    
    if (response.status === 200 && response.data) {
      // Ensure weather data has the expected structure
      const weatherData = response.data;
      
      // Log the weather data structure to help with debugging
      console.log('[DEBUG] Weather data structure:', JSON.stringify(weatherData, null, 2));
      
      // Check if we have valid temperature data
      if (weatherData.attributes && 
          typeof weatherData.attributes.temperature === 'number') {
        
        console.log(`[INFO] Weather temperature: ${weatherData.attributes.temperature}`);
        console.log(`[INFO] Weather condition: ${weatherData.state}`);
        
        // Format temperature with appropriate units
        const tempUnit = weatherData.attributes.temperature_unit || '°C';
        weatherData.formatted_temperature = `${Math.round(weatherData.attributes.temperature)}${tempUnit}`;
        
        res.json(weatherData);
      } else {
        console.warn('[WARN] Weather data missing temperature attribute');
        res.json({
          ...weatherData,
          formatted_temperature: 'N/A',
          _warning: 'Temperature data is missing or invalid'
        });
      }
    } else {
      console.error(`[ERROR] Weather API returned unexpected status: ${response.status}`);
      res.status(response.status || 500).json({ 
        error: 'Failed to fetch weather data', 
        details: 'Received unexpected response'
      });
    }
  } catch (error) {
    console.error('[ERROR] Error fetching weather data:', error.message);
    
    if (error.response) {
      console.error('[ERROR] Weather API Response Status:', error.response.status);
      console.error('[ERROR] Weather API Response Data:', error.response.data);
      
      // If entity not found, provide more helpful message
      if (error.response.status === 404) {
        return res.status(404).json({ 
          error: 'Weather entity not found', 
          details: `The configured weather entity was not found. Check your Home Assistant configuration.`,
          statusCode: 404
        });
      }
      
      res.status(error.response.status).json({ 
        error: 'Failed to fetch weather data', 
        details: error.response.data,
        statusCode: error.response.status
      });
    } else if (error.request) {
      console.error('[ERROR] No response received from weather API');
      res.status(500).json({ 
        error: 'No response received from Home Assistant weather API', 
        details: 'Request was made but no response was received'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch weather data', 
        details: error.message
      });
    }
  }
});

// GET endpoint for sun entity (sunrise/sunset times)
app.get('/api/sun', async (req, res) => {
  // Check if we have authentication
  if (!supervisorToken) {
    console.error('[ERROR] No authentication token available for sun API');
    return res.status(500).json({ 
      error: 'Authentication not configured', 
      details: 'SUPERVISOR_TOKEN or HASS_TOKEN environment variable not set'
    });
  }
  
  try {
    console.log(`[INFO] Fetching sun entity from: ${hassApiUrl}/states/sun.sun`);
    
    const response = await axios.get(`${hassApiUrl}/states/sun.sun`, { 
      headers: hassHeaders,
      timeout: 10000 // 10 second timeout
    });
    
    if (response.status === 200 && response.data) {
      console.log(`[INFO] Sun data retrieved successfully`);
      res.json(response.data);
    } else {
      console.error(`[ERROR] Sun API returned unexpected status: ${response.status}`);
      res.status(response.status || 500).json({ 
        error: 'Failed to fetch sun data', 
        details: 'Received unexpected response'
      });
    }
  } catch (error) {
    console.error('[ERROR] Error fetching sun data:', error.message);
    
    if (error.response) {
      console.error('[ERROR] Sun API Response Status:', error.response.status);
      console.error('[ERROR] Sun API Response Data:', error.response.data);
      
      res.status(error.response.status).json({ 
        error: 'Failed to fetch sun data', 
        details: error.response.data,
        statusCode: error.response.status
      });
    } else if (error.request) {
      console.error('[ERROR] No response received from sun API');
      res.status(500).json({ 
        error: 'No response received from Home Assistant sun API', 
        details: 'Request was made but no response was received'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch sun data', 
        details: error.message
      });
    }
  }
});

// GET endpoint for weather forecast using weather.get_forecasts service
app.get('/api/weather/forecast', async (req, res) => {
  if (!config || !config.show_weather) {
    console.log('[INFO] Weather display is disabled in config.');
    return res.json({ enabled: false });
  }
  
  // Check if we have authentication
  if (!supervisorToken) {
    console.error('[ERROR] No authentication token available for forecast API');
    return res.status(500).json({ 
      error: 'Authentication not configured', 
      details: 'SUPERVISOR_TOKEN or HASS_TOKEN environment variable not set'
    });
  }
  
  try {
    const weatherEntity = config.weather_entity || 'weather.forecast_home';
    console.log(`[INFO] Fetching forecast for entity: ${weatherEntity}`);
    
    // Call the weather.get_forecasts service with return_response query parameter
    // For REST API, use flat structure (not nested target/data)
    const response = await axios.post(`${hassApiUrl}/services/weather/get_forecasts?return_response=1`, {
      entity_id: weatherEntity,
      type: 'daily'
    }, { 
      headers: hassHeaders,
      timeout: 10000 // 10 second timeout
    });
    
    if (response.status === 200 && response.data) {
      console.log(`[INFO] Forecast data retrieved successfully`);
      console.log(`[DEBUG] Forecast response data:`, JSON.stringify(response.data, null, 2));
      
      // The response structure is: { service_response: { "weather.entity": { forecast: [...] } } }
      if (response.data.service_response && 
          response.data.service_response[weatherEntity] && 
          response.data.service_response[weatherEntity].forecast) {
        const forecastData = response.data.service_response[weatherEntity].forecast;
        console.log(`[INFO] Found forecast array with ${forecastData.length} days`);
        res.json({
          forecast: forecastData
        });
      } else {
        console.warn('[WARN] Forecast data structure unexpected');
        console.warn('[WARN] Response keys:', Object.keys(response.data));
        res.json({ forecast: [] });
      }
    } else {
      console.error(`[ERROR] Forecast API returned unexpected status: ${response.status}`);
      res.status(response.status || 500).json({ 
        error: 'Failed to fetch forecast data', 
        details: 'Received unexpected response'
      });
    }
  } catch (error) {
    console.error('[ERROR] Error fetching forecast data:', error.message);
    
    if (error.response) {
      console.error('[ERROR] Forecast API Response Status:', error.response.status);
      console.error('[ERROR] Forecast API Response Data:', error.response.data);
      
      res.status(error.response.status).json({ 
        error: 'Failed to fetch forecast data', 
        details: error.response.data,
        statusCode: error.response.status
      });
    } else if (error.request) {
      console.error('[ERROR] No response received from forecast API');
      res.status(500).json({ 
        error: 'No response received from Home Assistant forecast API', 
        details: 'Request was made but no response was received'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch forecast data', 
        details: error.message
      });
    }
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
  console.log(`Data directory: ${dataDir}`);
  
  // In production mode with kiosk_mode enabled, start the web browser
  if (isProduction && config.kiosk_mode) {
    console.log('Starting kiosk mode...');
    try {
      // Insert your browser startup code here if needed
    } catch (error) {
      console.error('Failed to start kiosk mode:', error);
    }
  }
});

io.on('connection', (socket) => {
  console.log('[DEBUG] Client connected (simplified for debugging)');
  // Temporarily comment out exec for kiosk mode
  /*
  socket.on('exit_kiosk', () => {
    console.log('[DEBUG] Received request to exit kiosk mode');
    if (config.kiosk_mode && process.env.DISPLAY) {
      exec('/usr/bin/exit-kiosk', (error) => {
        if (error) {
          console.error('[DEBUG] Failed to exit kiosk mode:', error);
        } else {
          console.log('[DEBUG] Kiosk mode exited successfully');
        }
      });
    }
  });
  */
  socket.on('disconnect', () => {
    console.log('[DEBUG] Client disconnected (simplified for debugging)');
  });
}); 