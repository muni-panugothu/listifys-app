'use strict';

/**
 * Curated push copy for engagement campaigns.
 * Use {area} for hyper-local personalization (city / neighborhood).
 */
const ENGAGEMENT_TEMPLATES = {
  weekend: [
    '🎉 It\'s Sunday! Find hidden gems near you on Listifys.',
    '☕ Lazy Sunday? Browse great deals from your couch.',
    '🚗 Sunday upgrade? Check out vehicles listed near you.',
    '🏠 Planning a move? Fresh rentals just landed nearby.',
  ],
  fomo: [
    '👀 Someone may have posted exactly what you\'re looking for.',
    '🔥 New deals are appearing near you right now.',
    '⏳ The best listings don\'t stay long. Take a look.',
    '💸 Why pay full price when someone nearby is selling it?',
    '👀 Something interesting was just posted near you.',
    '🔥 A deal in your area is getting lots of attention.',
    '😳 You might regret missing today\'s top listings.',
    '📍 New finds have arrived around you.',
    '💸 Why buy new when great deals are nearby?',
  ],
  morning: [
    '🌞 Good morning! New listings are waiting for you.',
    '☕ Coffee in one hand, great deals in the other.',
    '📱 Start your day with fresh finds on Listifys.',
  ],
  evening: [
    '🌙 Relaxing after work? Discover what\'s new nearby.',
    '🛋️ Your next great deal could be a scroll away.',
    '✨ New listings have arrived while you were busy.',
  ],
  salary: [
    '💰 Salary credited? Time to grab something you\'ve been wanting.',
    '🎉 Payday feels better when you save money.',
    '🛍️ Upgrade your lifestyle without breaking the bank.',
  ],
  fun: [
    '🤔 Still using that old phone?',
    '🚗 Dreaming of a bike upgrade?',
    '🏡 Looking for a better place to stay?',
    '📦 One person\'s old stuff is another person\'s jackpot.',
  ],
  hyperlocal: [
    '📍 {area} is buzzing with new listings today.',
    '🔥 Your neighborhood has fresh deals waiting.',
    '👋 Your next bargain might be just a few streets away.',
  ],
  cars: [
    '🚗 Your dream ride might have just been listed.',
    '⛽ Save on fuel, not on your dreams.',
  ],
  electronics: [
    '📱 New phones. Better prices. Same city.',
    '💻 Upgrade season starts now.',
  ],
  properties: [
    '🏠 House hunting? New rentals are live.',
    '🔑 A better home could be waiting nearby.',
  ],
  re_engagement: [
    '😭 Your wishlist misses you.',
    '👀 We\'ve been saving some great deals for you.',
    '🔥 Thousands of people found deals today. Did you?',
  ],
  viral: [
    '🚨 Wait… people are selling THIS for that price?',
    '😳 You won\'t believe what\'s listed near you.',
    '🔥 This deal is getting a lot of attention.',
    '👀 Don\'t open Listifys unless you like finding bargains.',
  ],
  festival: [
    '🎇 Before you shop new, check what\'s available nearby.',
    '🎁 Festival upgrades don\'t have to be expensive.',
    '🛍️ Smart shoppers check Listifys first.',
  ],
};

const CAMPAIGN_TITLES = {
  weekend: 'Listifys · Sunday picks',
  fomo: 'Listifys · Don\'t miss out',
  morning: 'Good morning',
  evening: 'Evening finds',
  salary: 'Payday deals',
  fun: 'Listifys',
  hyperlocal: 'Near you',
  cars: 'Vehicles near you',
  electronics: 'Tech deals',
  properties: 'Homes & rentals',
  re_engagement: 'We miss you',
  viral: 'Listifys',
  festival: 'Festival savings',
};

/** Maps scheduler slot → template pools to pick from */
const CAMPAIGN_POOLS = {
  morning: ['morning', 'fomo', 'fun'],
  evening: ['evening', 'fomo', 'viral'],
  weekend: ['weekend', 'hyperlocal', 'fomo'],
  fomo: ['fomo', 'viral', 'fun'],
  salary: ['salary', 'electronics', 'cars', 'festival'],
  re_engagement: ['re_engagement', 'fomo', 'viral'],
};

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function personalize(text, area) {
  const place = area?.trim() || 'your area';
  return text.replace(/\{area\}/g, place);
}

function buildEngagementMessage(campaign, area) {
  const pools = CAMPAIGN_POOLS[campaign] || [campaign];
  const poolKey = pickRandom(pools);
  const templates = ENGAGEMENT_TEMPLATES[poolKey] || ENGAGEMENT_TEMPLATES.fomo;
  const body = personalize(pickRandom(templates), area);
  const title = CAMPAIGN_TITLES[poolKey] || CAMPAIGN_TITLES[campaign] || 'Listifys';
  return { title, body, poolKey };
}

module.exports = {
  ENGAGEMENT_TEMPLATES,
  CAMPAIGN_TITLES,
  CAMPAIGN_POOLS,
  buildEngagementMessage,
  personalize,
  pickRandom,
};
