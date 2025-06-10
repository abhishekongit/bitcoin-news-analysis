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

// Initialize function to start the application
async function initialize() {
    if (!proxyUrl || !API_KEY || !NEWS_API_BASE_URL || !formattedDate) {
        updateStatus('Missing required configuration', 'danger');
        return;
    }
    try {
        const articles = await fetchNews();
        await processArticles(articles);
    } catch (error) {
        console.error('Error initializing:', error);
    } catch (error) {
        console.error('Error initializing:', error);
        updateStatus(`Failed to initialize: ${error.message}`, 'danger');
    }
}

async function fetchNews() {
    try {
        // Create query parameters
        const params = new URLSearchParams({
            q: 'bitcoin',
            from: formattedDate,
            sortBy: 'publishedAt',
            language: 'en',
            pageSize: 100,
            apiKey: API_KEY
        });

        // Log the full URL for debugging
        const fullUrl = `${NEWS_API_BASE_URL}?${params}`;
        console.log('Fetching from:', fullUrl);

        // Use proxy URL to bypass CORS
        const response = await fetch(`${proxyUrl}${fullUrl}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        
        if (data.status !== 'ok') {
            throw new Error(`News API error: ${data.message || 'Unknown error'}`);
        }

        return data.articles || [];
    } catch (error) {
        console.error('Error fetching news:', error);
        updateStatus(`Error loading news: ${error.message}`, 'danger');
        throw error;
    }
    } catch (error) {
        console.error('Error fetching news:', error);
        updateStatus(`Error loading news: ${error.message}`, 'danger');
        throw error;
    }
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
    let bullishContent = '';
    let bearishContent = '';
    const newsList = document.getElementById('newsArticles');
    
    // Clear loading message
    newsList.innerHTML = '';

    for (const article of articles) {
        // Create news item
        const newsItem = document.createElement('div');
        newsItem.className = 'card mb-3';
        newsItem.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${article.title}</h5>
                <p class="card-text">${article.description}</p>
                <a href="${article.url}" class="btn btn-primary" target="_blank">Read More</a>
            </div>
        `;
        newsList.appendChild(newsItem);

        // Analyze sentiment
        const sentiment = analyzeSentiment(article.description || article.title);
        
        // Add article to appropriate summary
        if (sentiment.score > 0) {
            bullishContent += `<p><strong>${article.title}</strong>: ${article.description}</p>`;
        } else if (sentiment.score < 0) {
            bearishContent += `<p><strong>${article.title}</strong>: ${article.description}</p>`;
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

// Main function to initialize the application
async function initialize() {
    try {
        const articles = await fetchNews();
        await processArticles(articles);
    } catch (error) {
        console.error('Error initializing:', error);
        document.getElementById('bullishSummary').innerHTML = 'Error loading data. Please try again later.';
        document.getElementById('bearishSummary').innerHTML = 'Error loading data. Please try again later.';
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', initialize);
