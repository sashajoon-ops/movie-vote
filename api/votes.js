// api/votes.js
import { kv } from '@vercel/kv';

const movies = [
  'Roman Holiday',
  'Dog Day Afternoon',
  'Casino Royale',
  'From Russia with Love',
  'Sunset Boulevard',
  'The French Connection',
  'Michael Clayton',
  'Grease',
  'The Straight Story',
  'C\'Mon C\'Mon',
  'Cabaret',
  'Marie Antoinette',
  'The Dink',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      const { voter, ranking } = req.body;
      
      if (!voter || !ranking || ranking.length === 0) {
        return res.status(400).json({ error: 'Invalid vote' });
      }

      const votes = await kv.get('movie_votes') || [];
      votes.push({ voter, ranking });
      await kv.set('movie_votes', votes);

      return res.status(200).json({ 
        success: true, 
        totalVotes: votes.length,
        message: `Vote submitted! ${votes.length}/8 votes`
      });
    }

    if (req.method === 'GET') {
      const votes = await kv.get('movie_votes') || [];
      
      if (votes.length === 0) {
        return res.status(200).json({ 
          votes: [],
          totalVotes: 0,
          movies,
          ready: false
        });
      }

      let rounds = [];
      let remaining = new Set(movies);
      let allVotes = JSON.parse(JSON.stringify(votes));

      while (remaining.size > 1) {
        const counts = {};
        remaining.forEach(m => (counts[m] = 0));

        allVotes.forEach(vote => {
          const firstChoice = vote.ranking.find(m => remaining.has(m));
          if (firstChoice) counts[firstChoice]++;
        });

        rounds.push({ votes: { ...counts }, remaining: Array.from(remaining) });

        let minVotes = Infinity;
        let toEliminate = '';
        remaining.forEach(m => {
          if (counts[m] < minVotes) {
            minVotes = counts[m];
            toEliminate = m;
          }
        });

        remaining.delete(toEliminate);
      }

      const winner = remaining.size > 0 ? Array.from(remaining)[0] : null;

      return res.status(200).json({
        votes,
        totalVotes: votes.length,
        movies,
        rounds,
        winner,
        ready: votes.length >= 8
      });
    }

    if (req.method === 'PUT') {
      await kv.del('movie_votes');
      return res.status(200).json({ success: true });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
