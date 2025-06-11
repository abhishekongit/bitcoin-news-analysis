// Get variables from global scope (defined in HTML)
const proxyUrl = window.proxyUrl || '';
const API_KEY = window.API_KEY || '';
const NEWS_API_BASE_URL = window.NEWS_API_BASE_URL || '';
const DEFAULT_QUERY_PARAMS = window.DEFAULT_QUERY_PARAMS || {};
const formattedDate = window.formattedDate || '';

// Update status message function
const updateStatus = window.updateStatus || ((message, type) => {
    console.log(`Status: ${message}`);
});

// Cache configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY = 'bitcoin-news-cache';

// Initialize IndexedDB
document.addEventListener('DOMContentLoaded', async () => {
    await initializeDB();
});

async function initializeDB() {
    try {
        const request = indexedDB.open('BitcoinNewsCache', 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('articles')) {
                db.createObjectStore('articles', { keyPath: 'date' });
            }
        };

        request.onerror = (event) => {
            console.error('Error initializing database:', event.target.error);
        };

        request.onsuccess = (event) => {
            console.log('Database initialized successfully');
        };
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Initialize function to start the application
async function initialize() {
    if (!proxyUrl || !API_KEY || !NEWS_API_BASE_URL || !formattedDate) {
        updateStatus('Missing required configuration', 'danger');
        return;
    }
    try {
        updateStatus('Fetching news articles...', 'info');
        const articles = await fetchNews();
        if (!articles || articles.length === 0) {
            updateStatus('No articles found', 'warning');
            return;
        }
        await processArticles(articles);
        updateStatus('Articles loaded successfully', 'success');
    } catch (error) {
        console.error('Error initializing:', error);
        updateStatus(`Failed to initialize: ${error.message}`, 'danger');
    }
}

async function fetchNews() {
    try {
        console.log('=== Starting fetchNews ===');
        console.log('Configuration:', {
            NEWS_API_BASE_URL,
            API_KEY: API_KEY ? '***' : 'undefined',
            formattedDate,
            proxyUrl
        });

        // Create query parameters
        const queryParams = new URLSearchParams({
            q: 'bitcoin',
            from: formattedDate,
            sortBy: 'publishedAt',
            language: 'en',
            pageSize: 100,
            apiKey: API_KEY
        });
        console.log('Query parameters:', queryParams.toString());

        // Try to get from cache first
        const cachedArticles = await getCachedArticles(formattedDate);
        if (cachedArticles) {
            console.log('Using cached articles');
            return cachedArticles;
        }

        // Try multiple approaches
        const approaches = [
            // Direct request (should work since API key is valid)
            { name: 'direct', url: `${NEWS_API_BASE_URL}?${queryParams}` },
            // Try with local proxy
            { name: 'local-proxy', url: `${proxyUrl}${NEWS_API_BASE_URL}?${queryParams}` },
            // Try with alternative CORS proxy
            { name: 'alternative-proxy', url: `https://api.allorigins.win/get?url=${encodeURIComponent(`${NEWS_API_BASE_URL}?${queryParams}`)}` }
        ];

        console.log('Available approaches:', approaches.map(a => a.name));

        let successfulResponse;
        for (const approach of approaches) {
            console.log(`\n=== Attempting approach: ${approach.name} ===`);
            console.log('Request URL:', approach.url);
            
            try {
                console.log('Making request...');
                const response = await fetch(approach.url);
                
                console.log('Response status:', response.status);
                
                if (response.ok) {
                    console.log(`${approach.name} approach succeeded!`);
                    successfulResponse = response;
                    break;
                } else {
                    console.log(`${approach.name} failed with status: ${response.status}`);
                    const errorText = await response.text();
                    console.error(`${approach.name} error response:`, errorText.substring(0, 200));
                }
            } catch (error) {
                console.error(`${approach.name} failed with error:`, error);
            }
        }

        if (!successfulResponse) {
            throw new Error('All approaches failed to fetch data');
        }

        console.log('Got successful response, parsing...');
        const responseText = await successfulResponse.text();
        console.log('Response text (first 200 chars):', responseText.substring(0, 200));

        // First try to parse as direct response
        try {
            const data = JSON.parse(responseText);
            console.log('Successfully parsed direct response:', {
                status: data.status,
                articleCount: data.articles?.length || 0
            });

            if (data.status !== 'ok') {
                throw new Error(`News API error: ${data.message || 'Unknown error'}`);
            }

            // Cache the articles
            await cacheArticles(formattedDate, data.articles);
            return data.articles || [];
        } catch (directError) {
            console.log('Failed to parse as direct response, trying proxy response...');
            try {
                // Try parsing as proxy response
                const proxyResponse = JSON.parse(responseText);
                const data = JSON.parse(proxyResponse.contents);
                console.log('Successfully parsed proxy response:', {
                    status: data.status,
                    articleCount: data.articles?.length || 0
                });

                if (data.status !== 'ok') {
                    throw new Error(`News API error: ${data.message || 'Unknown error'}`);
                }

                // Cache the articles
                await cacheArticles(formattedDate, data.articles);
                return data.articles || [];
            } catch (proxyError) {
                console.error('Error parsing response:', proxyError);
                console.error('Response text:', responseText);
                throw new Error(`Invalid JSON response: ${proxyError.message}. Raw response: ${responseText.substring(0, 200)}`);
            }
        }
    } catch (error) {
        console.error('=== Error in fetchNews ===');
        console.error('Error details:', error);
        updateStatus(`Error loading news: ${error.message}`, 'danger');
        throw error;
    }
}

async function cacheArticles(date, articles) {
    try {
        const db = await openDB();
        const tx = db.transaction('articles', 'readwrite');
        const store = tx.objectStore('articles');
        
        const entry = {
            date,
            articles,
            timestamp: Date.now()
        };
        
        await new Promise((resolve, reject) => {
            const request = store.put(entry);
            request.onsuccess = resolve;
            request.onerror = reject;
        });
        
        console.log('Articles cached successfully');
    } catch (error) {
        console.error('Error caching articles:', error);
    }
}

async function getCachedArticles(date) {
    try {
        const db = await openDB();
        const tx = db.transaction('articles', 'readonly');
        const store = tx.objectStore('articles');
        
        const request = store.get(date);
        const data = await new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
        
        if (data && Date.now() - data.timestamp < CACHE_DURATION) {
            console.log('Returning cached articles');
            return data.articles;
        }
        
        // If cache is expired, delete it
        if (data) {
            const deleteTx = db.transaction('articles', 'readwrite');
            const deleteStore = deleteTx.objectStore('articles');
            deleteStore.delete(date);
        }
        
        return null;
    } catch (error) {
        console.error('Error getting cached articles:', error);
        return null;
    }
}

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BitcoinNewsCache', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Simple sentiment analysis using keywords
function analyzeSentiment(text) {
    const bullishKeywords = ['rise', 'gain', 'up', 'increase', 'bull', 'positive', 'optimistic', 'growth', 'strong', 'upward'];
    const bearishKeywords = ['fall', 'drop', 'down', 'decrease', 'bear', 'negative', 'pessimistic', 'weak', 'downward', 'loss'];
    
    const textLower = text.toLowerCase();
    
    // Count keyword occurrences
    let bullishScore = 0;
    let bearishScore = 0;
    
    bullishKeywords.forEach(keyword => {
        bullishScore += (textLower.match(new RegExp(keyword, 'g')) || []).length;
    });
    
    bearishKeywords.forEach(keyword => {
        bearishScore += (textLower.match(new RegExp(keyword, 'g')) || []).length;
    });
    
    return {
        score: bullishScore - bearishScore,
        bullishScore,
        bearishScore
    };
}

function processArticles(articles) {
    if (!articles || !Array.isArray(articles)) {
        console.error('Invalid articles data:', articles);
        updateStatus('Invalid news articles data received', 'danger');
        return;
    }

    let bullishContent = '';
    let bearishContent = '';
    const newsList = document.getElementById('newsArticles');
    
    // Clear loading message
    newsList.innerHTML = '';

    for (const article of articles) {
        try {
            // Create news item
            const newsItem = document.createElement('div');
            newsItem.className = 'card mb-3';
            
            // Handle undefined values safely
            const title = article.title || 'No title available';
            const description = article.description || 'No description available';
            const url = article.url || '#';
            
            newsItem.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">${title}</h5>
                    <p class="card-text">${description}</p>
                    <a href="${url}" class="btn btn-primary" target="_blank">Read More</a>
                </div>
            `;
            newsList.appendChild(newsItem);

            // Analyze sentiment
            const sentiment = analyzeSentiment(description || title);
            
            // Add to appropriate summary
            if (sentiment.score > 0) {
                bullishContent += `<p><strong>${title}</strong>: ${description}</p>`;
            } else if (sentiment.score < 0) {
                bearishContent += `<p><strong>${title}</strong>: ${description}</p>`;
            }
        } catch (error) {
            console.error('Error processing article:', error);
            continue;
        }
    }

    // Update summaries
    document.getElementById('bullishSummary').innerHTML = `
        <h4>Bullish Articles (${bullishContent.split('<p>').length - 1} articles)</h4>
        ${bullishContent}
    `;
    document.getElementById('bearishSummary').innerHTML = `
        <h4>Bearish Articles (${bearishContent.split('<p>').length - 1} articles)</h4>
        ${bearishContent}
    `;
}

// Initialize the app when DOM is loaded
async function initialize() {
    try {
        await fetchNews();
    } catch (error) {
        console.error('Error in initialization:', error);
        updateStatus(`Error initializing app: ${error.message}`, 'danger');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);
