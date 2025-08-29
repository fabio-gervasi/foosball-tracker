import React, { useState, useMemo } from 'react';
import {
  Trophy,
  User,
  TrendingUp,
  Calendar,
  BarChart3,
  Users,
  Skull,
  Heart,
  Target,
  Zap,
  Award,
  Activity,
} from 'lucide-react';
import { Avatar } from '../Avatar';
import type { User as UserType, Match, Group } from '../../types';

// Custom SVG chart component to avoid flickering issues with Recharts
function EloChart({ data }: { data: Array<{ date: string; elo: number; formattedDate: string }> }) {
  const chartWidth = 300;
  const chartHeight = 120;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };

  if (!data || data.length === 0) {
    return (
      <div className='flex items-center justify-center h-full text-gray-500'>
        <p className='text-sm'>No ELO data available</p>
      </div>
    );
  }

  // Calculate min and max ELO values with padding
  const eloValues = data.map(d => d.elo);
  const minElo = Math.min(...eloValues) - 10;
  const maxElo = Math.max(...eloValues) + 10;
  const eloRange = maxElo - minElo;

  // Calculate chart dimensions
  const chartInnerWidth = chartWidth - padding.left - padding.right;
  const chartInnerHeight = chartHeight - padding.top - padding.bottom;

  // Scale functions
  const scaleX = (index: number) => (index / (data.length - 1)) * chartInnerWidth + padding.left;
  const scaleY = (elo: number) =>
    chartHeight - padding.bottom - ((elo - minElo) / eloRange) * chartInnerHeight;

  // Generate path for the line
  const pathData = data
    .map((point, index) => {
      const x = scaleX(index);
      const y = scaleY(point.elo);
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  // Generate grid lines
  const gridLinesY = [];
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = padding.top + (i / gridSteps) * chartInnerHeight;
    gridLinesY.push(
      <line
        key={`grid-y-${i}`}
        x1={padding.left}
        y1={y}
        x2={chartWidth - padding.right}
        y2={y}
        stroke='#e0e7ff'
        strokeDasharray='3 3'
        strokeWidth={1}
      />
    );
  }

  // Generate Y-axis labels
  const yLabels = [];
  for (let i = 0; i <= gridSteps; i++) {
    const elo = maxElo - (i / gridSteps) * eloRange;
    const y = padding.top + (i / gridSteps) * chartInnerHeight;
    yLabels.push(
      <text
        key={`y-label-${i}`}
        x={padding.left - 8}
        y={y + 4}
        textAnchor='end'
        fontSize={10}
        fill='#6b7280'
      >
        {Math.round(elo)}
      </text>
    );
  }

  // Generate X-axis labels (show only first, middle, and last)
  const xLabels: React.ReactElement[] = [];
  const labelIndices =
    data.length === 1
      ? [0]
      : data.length === 2
        ? [0, 1]
        : [0, Math.floor(data.length / 2), data.length - 1];

  labelIndices.forEach(index => {
    if (data[index]) {
      const x = scaleX(index);
      xLabels.push(
        <text
          key={`x-label-${index}`}
          x={x}
          y={chartHeight - padding.bottom + 15}
          textAnchor='middle'
          fontSize={10}
          fill='#6b7280'
        >
          {data[index].formattedDate}
        </text>
      );
    }
  });

  return (
    <div className='w-full h-full flex items-center justify-center'>
      <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Grid lines */}
        {gridLinesY}

        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={chartHeight - padding.bottom}
          stroke='#6b7280'
          strokeWidth={1}
        />

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          stroke='#6b7280'
          strokeWidth={1}
        />

        {/* ELO line */}
        <path
          d={pathData}
          fill='none'
          stroke='#0d9488'
          strokeWidth={2}
          strokeLinecap='round'
          strokeLinejoin='round'
        />

        {/* Data points */}
        {data.map((point, index) => (
          <circle
            key={`point-${index}`}
            cx={scaleX(index)}
            cy={scaleY(point.elo)}
            r={3}
            fill='#0d9488'
            stroke='#ffffff'
            strokeWidth={1}
          />
        ))}

        {/* Axis labels */}
        {yLabels}
        {xLabels}
      </svg>
    </div>
  );
}

interface StatisticsProps {
  user: UserType;
  matches: Match[];
  group: Group | null;
}

export function Statistics({ user, matches, group }: StatisticsProps) {
  const [selectedMatchType, setSelectedMatchType] = useState<'all' | '1v1' | '2v2'>('all');
  const userIdentifier = user.username || user.email;

  // Filter matches for this specific user (supports both new and legacy formats) - memoized
  const userMatches = useMemo(() => {
    return matches.filter(match => {
      // First filter by user participation
      let isUserInMatch = false;

      // Handle 1v1 matches
      if (match.matchType === '1v1' || !match.matchType) {
        // New format
        if (match.player1?.id && match.player2?.id) {
          isUserInMatch = match.player1.id === user.id || match.player2.id === user.id;
        } else {
          // Legacy format
          isUserInMatch =
            match.player1Email === userIdentifier ||
            match.player2Email === userIdentifier ||
            match.player1Email === user.email ||
            match.player2Email === user.email;
        }
      }
      // Handle 2v2 matches
      else if (match.matchType === '2v2') {
        // New format
        if (
          match.team1?.player1?.id &&
          match.team1?.player2?.id &&
          match.team2?.player1?.id &&
          match.team2?.player2?.id
        ) {
          isUserInMatch =
            match.team1.player1.id === user.id ||
            match.team1.player2.id === user.id ||
            match.team2.player1.id === user.id ||
            match.team2.player2.id === user.id;
        } else {
          // Legacy format
          isUserInMatch =
            match.team1Player1Email === userIdentifier ||
            match.team1Player2Email === userIdentifier ||
            match.team2Player1Email === userIdentifier ||
            match.team2Player2Email === userIdentifier ||
            match.team1Player1Email === user.email ||
            match.team1Player2Email === user.email ||
            match.team2Player1Email === user.email ||
            match.team2Player2Email === user.email;
        }
      }

      // Now filter by match type if specified
      if (!isUserInMatch) return false;

      if (selectedMatchType === 'all') return true;
      if (selectedMatchType === '1v1') return match.matchType === '1v1' || !match.matchType;
      if (selectedMatchType === '2v2') return match.matchType === '2v2';

      return false;
    });
  }, [matches, user.id, user.email, userIdentifier, selectedMatchType]);

  // Helper function to check if user won a match
  const isMatchWinner = (match: any) => {
    if (match.matchType === '1v1' || !match.matchType) {
      // New format
      if (match.winner?.id) {
        return match.winner.id === user.id;
      }
      // Legacy format
      return match.winnerEmail === user.email || match.winnerEmail === userIdentifier;
    } else if (match.matchType === '2v2') {
      // New format
      if (
        match.team1?.player1?.id &&
        match.team1?.player2?.id &&
        match.team2?.player1?.id &&
        match.team2?.player2?.id
      ) {
        const isInTeam1 = match.team1.player1.id === user.id || match.team1.player2.id === user.id;
        const isInTeam2 = match.team2.player1.id === user.id || match.team2.player2.id === user.id;
        return (
          (isInTeam1 && match.winningTeam === 'team1') ||
          (isInTeam2 && match.winningTeam === 'team2')
        );
      }
      // Legacy format
      const isInTeam1 =
        match.team1Player1Email === userIdentifier ||
        match.team1Player2Email === userIdentifier ||
        match.team1Player1Email === user.email ||
        match.team1Player2Email === user.email;
      const isInTeam2 =
        match.team2Player1Email === userIdentifier ||
        match.team2Player2Email === userIdentifier ||
        match.team2Player1Email === user.email ||
        match.team2Player2Email === user.email;
      return (
        (isInTeam1 && match.winningTeam === 'team1') || (isInTeam2 && match.winningTeam === 'team2')
      );
    }
    return false;
  };

  // Calculate actual wins and losses from filtered matches
  let actualWins = 0;
  let actualLosses = 0;

  userMatches.forEach(match => {
    if (isMatchWinner(match)) {
      actualWins++;
    } else {
      actualLosses++;
    }
  });

  // Calculate statistics using actual match data
  const totalGames = actualWins + actualLosses;
  const winRate = totalGames > 0 ? ((actualWins / totalGames) * 100).toFixed(1) : '0';

  // Recent form (last 5 games) - reverse to get most recent first
  const recentMatches = [...userMatches].reverse().slice(0, 5);
  const recentForm = recentMatches.map(match => (isMatchWinner(match) ? 'W' : 'L'));

  // Win streak calculation - use reversed matches for chronological order
  let currentStreak = 0;
  let streakType = '';

  const reversedMatches = [...userMatches].reverse();
  for (const match of reversedMatches) {
    const isWin = isMatchWinner(match);
    if (isWin) {
      if (streakType === 'W' || streakType === '') {
        currentStreak++;
        streakType = 'W';
      } else {
        break;
      }
    } else {
      if (streakType === 'L' || streakType === '') {
        currentStreak++;
        streakType = 'L';
      } else {
        break;
      }
    }
  }

  const getMonthlyStats = () => {
    const monthlyData: Record<string, { wins: number; losses: number }> = {};
    userMatches.forEach(match => {
      const month = match.date.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { wins: 0, losses: 0 };
      }
      if (isMatchWinner(match)) {
        monthlyData[month].wins++;
      } else {
        monthlyData[month].losses++;
      }
    });
    return Object.entries(monthlyData)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6);
  };

  const monthlyStats = getMonthlyStats();

  // Calculate ELO statistics based on selected match type
  const totalEloChange = userMatches.reduce((total, match) => {
    const userEloChange =
      match.eloChanges?.[user.email]?.change ||
      match.eloChanges?.[userIdentifier]?.change ||
      match.eloChanges?.[user.id]?.change ||
      0;
    return total + userEloChange;
  }, 0);

  const averageEloChange =
    userMatches.length > 0 ? (totalEloChange / userMatches.length).toFixed(1) : '0';

  // Get the appropriate ELO rating based on selected filter - memoized
  const currentFilteredElo = useMemo(() => {
    if (selectedMatchType === '1v1') {
      return user.singlesElo || user.elo || 1200;
    } else if (selectedMatchType === '2v2') {
      return user.doublesElo || 1200;
    } else {
      // For 'all', show overall/legacy ELO
      return user.elo || 1200;
    }
  }, [selectedMatchType, user.singlesElo, user.doublesElo, user.elo]);

  // Build ELO timeline data for chart (memoized to prevent flickering)
  const eloTimelineData = useMemo(() => {
    // Sort matches by date to get chronological order
    const sortedMatches = [...userMatches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (sortedMatches.length === 0) {
      // No matches - show current ELO as a single point
      return [
        {
          date: new Date().toISOString().split('T')[0],
          elo: currentFilteredElo,
          formattedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        },
      ];
    }

    const timelineData = [];
    let currentElo = 1200; // Starting ELO

    // Add starting point
    const firstMatchDate = new Date(sortedMatches[0].date);
    timelineData.push({
      date: sortedMatches[0].date,
      elo: currentElo,
      formattedDate: firstMatchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });

    // Process each match to build timeline
    sortedMatches.forEach(match => {
      const userEloData =
        match.eloChanges?.[user.email] ||
        match.eloChanges?.[userIdentifier] ||
        match.eloChanges?.[user.id];
      if (userEloData?.newRating) {
        currentElo = userEloData.newRating;
        const matchDate = new Date(match.date);
        timelineData.push({
          date: match.date,
          elo: currentElo,
          formattedDate: matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        });
      }
    });

    return timelineData;
  }, [userMatches, currentFilteredElo, user.email, user.id, userIdentifier]);

  // Get highest and lowest ELO from timeline data
  const eloValues = eloTimelineData.map(point => point.elo);
  const highestElo = eloValues.length > 0 ? Math.max(...eloValues) : currentFilteredElo;
  const lowestElo = eloValues.length > 0 ? Math.min(...eloValues) : currentFilteredElo;

  // Calculate opponent statistics (for both 1v1 and 2v2 matches)
  interface OpponentStats {
    name: string;
    wins: number;
    losses: number;
    total: number;
  }

  const rawOpponentStats: Record<string, OpponentStats> = {};
  userMatches.forEach(match => {
    const opponents = [];

    // Handle 1v1 matches
    if (match.matchType === '1v1' || !match.matchType) {
      let opponent = null;
      let opponentIdentifier = null;

      // New format
      if (match.player1?.id && match.player2?.id) {
        opponent = match.player1.id === user.id ? match.player2 : match.player1;
        opponentIdentifier = opponent.id;
      } else {
        // Legacy format
        const isPlayer1 =
          match.player1Email === userIdentifier || match.player1Email === user.email;
        opponentIdentifier = isPlayer1 ? match.player2Email : match.player1Email;
        opponent = { name: isPlayer1 ? match.player2 : match.player1 };
      }

      if (opponentIdentifier && opponent) {
        opponents.push({ identifier: opponentIdentifier, opponent });
      }
    }
    // Handle 2v2 matches
    else if (match.matchType === '2v2') {
      // New format
      if (
        match.team1?.player1?.id &&
        match.team1?.player2?.id &&
        match.team2?.player1?.id &&
        match.team2?.player2?.id
      ) {
        const isInTeam1 = match.team1.player1.id === user.id || match.team1.player2.id === user.id;
        const enemyTeam = isInTeam1 ? match.team2 : match.team1;

        opponents.push(
          { identifier: enemyTeam.player1.id, opponent: enemyTeam.player1 },
          { identifier: enemyTeam.player2.id, opponent: enemyTeam.player2 }
        );
      } else {
        // Legacy format - determine which team the user is on
        const isInTeam1 =
          match.team1Player1Email === userIdentifier ||
          match.team1Player2Email === userIdentifier ||
          match.team1Player1Email === user.email ||
          match.team1Player2Email === user.email;

        if (isInTeam1) {
          // User is in team1, opponents are team2
          opponents.push(
            { identifier: match.team2Player1Email, opponent: { name: match.team2Player1Email } },
            { identifier: match.team2Player2Email, opponent: { name: match.team2Player2Email } }
          );
        } else {
          // User is in team2, opponents are team1
          opponents.push(
            { identifier: match.team1Player1Email, opponent: { name: match.team1Player1Email } },
            { identifier: match.team1Player2Email, opponent: { name: match.team1Player2Email } }
          );
        }
      }
    }

    // Process all opponents for this match
    opponents.forEach(({ identifier, opponent }) => {
      if (identifier && opponent) {
        const opponentName =
          typeof opponent.name === 'string'
            ? opponent.name
            : (typeof opponent.name === 'object' ? opponent.name?.name : null) || identifier;

        if (!rawOpponentStats[identifier]) {
          rawOpponentStats[identifier] = {
            name: opponentName,
            wins: 0,
            losses: 0,
            total: 0,
          };
        }

        rawOpponentStats[identifier].total++;
        if (isMatchWinner(match)) {
          rawOpponentStats[identifier].wins++;
        } else {
          rawOpponentStats[identifier].losses++;
        }
      }
    });
  });

  // Now consolidate by name to handle duplicates
  const consolidatedOpponentStats: Record<string, OpponentStats> = {};
  Object.values(rawOpponentStats).forEach(stats => {
    const normalizedName = stats.name.toLowerCase().trim();

    if (!consolidatedOpponentStats[normalizedName]) {
      consolidatedOpponentStats[normalizedName] = {
        name: stats.name, // Keep original case
        wins: 0,
        losses: 0,
        total: 0,
      };
    }

    consolidatedOpponentStats[normalizedName].wins += stats.wins;
    consolidatedOpponentStats[normalizedName].losses += stats.losses;
    consolidatedOpponentStats[normalizedName].total += stats.total;
  });

  const opponentList = Object.values(consolidatedOpponentStats)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Calculate Most Feared Opponent (worst win rate against in ALL matches)
  const getMostFearedOpponent = () => {
    interface AllOpponentStats {
      name: string;
      wins: number;
      losses: number;
      total: number;
      avatar: string;
    }

    const rawAllOpponentStats: Record<string, AllOpponentStats> = {};

    userMatches.forEach(match => {
      const opponents = [];

      // Handle 1v1 matches
      if (match.matchType === '1v1' || !match.matchType) {
        let opponent = null;
        let opponentIdentifier = null;

        // New format
        if (match.player1?.id && match.player2?.id) {
          opponent = match.player1.id === user.id ? match.player2 : match.player1;
          opponentIdentifier = opponent.id;
        } else {
          // Legacy format
          const isPlayer1 =
            match.player1Email === userIdentifier || match.player1Email === user.email;
          opponentIdentifier = isPlayer1 ? match.player2Email : match.player1Email;
          opponent = { name: isPlayer1 ? match.player2 : match.player1 };
        }

        if (opponentIdentifier && opponent) {
          opponents.push({ identifier: opponentIdentifier, opponent });
        }
      }
      // Handle 2v2 matches
      else if (match.matchType === '2v2') {
        // New format
        if (
          match.team1?.player1?.id &&
          match.team1?.player2?.id &&
          match.team2?.player1?.id &&
          match.team2?.player2?.id
        ) {
          const isInTeam1 =
            match.team1.player1.id === user.id || match.team1.player2.id === user.id;
          const enemyTeam = isInTeam1 ? match.team2 : match.team1;

          opponents.push(
            { identifier: enemyTeam.player1.id, opponent: enemyTeam.player1 },
            { identifier: enemyTeam.player2.id, opponent: enemyTeam.player2 }
          );
        } else {
          // Legacy format - determine which team the user is on
          const isInTeam1 =
            match.team1Player1Email === userIdentifier ||
            match.team1Player2Email === userIdentifier ||
            match.team1Player1Email === user.email ||
            match.team1Player2Email === user.email;

          if (isInTeam1) {
            // User is in team1, opponents are team2
            opponents.push(
              { identifier: match.team2Player1Email, opponent: { name: match.team2Player1Email } },
              { identifier: match.team2Player2Email, opponent: { name: match.team2Player2Email } }
            );
          } else {
            // User is in team2, opponents are team1
            opponents.push(
              { identifier: match.team1Player1Email, opponent: { name: match.team1Player1Email } },
              { identifier: match.team1Player2Email, opponent: { name: match.team1Player2Email } }
            );
          }
        }
      }

      // Process all opponents for this match
      opponents.forEach(({ identifier, opponent }) => {
        if (identifier && opponent) {
          const opponentName =
            typeof opponent.name === 'string'
              ? opponent.name
              : (typeof opponent.name === 'object' ? opponent.name?.name : null) || identifier;

          if (!rawAllOpponentStats[identifier]) {
            rawAllOpponentStats[identifier] = {
              name: opponentName,
              wins: 0,
              losses: 0,
              total: 0,
              avatar:
                (opponent as any)?.avatar || opponentName?.[0] || identifier[0]?.toUpperCase(),
            };
          }

          rawAllOpponentStats[identifier].total++;
          if (isMatchWinner(match)) {
            rawAllOpponentStats[identifier].wins++;
          } else {
            rawAllOpponentStats[identifier].losses++;
          }
        }
      });
    });

    // Consolidate by name to handle duplicates
    const consolidatedAllOpponentStats: Record<string, AllOpponentStats> = {};
    Object.values(rawAllOpponentStats).forEach(stats => {
      const normalizedName = stats.name.toLowerCase().trim();

      if (!consolidatedAllOpponentStats[normalizedName]) {
        consolidatedAllOpponentStats[normalizedName] = {
          name: stats.name,
          wins: 0,
          losses: 0,
          total: 0,
          avatar: stats.avatar,
        };
      }

      consolidatedAllOpponentStats[normalizedName].wins += stats.wins;
      consolidatedAllOpponentStats[normalizedName].losses += stats.losses;
      consolidatedAllOpponentStats[normalizedName].total += stats.total;
    });

    // Find opponent with worst win rate (minimum 3 games)
    const qualifiedOpponents = Object.values(consolidatedAllOpponentStats).filter(
      opp => opp.total >= 3
    );
    if (qualifiedOpponents.length === 0) return null;

    const mostFeared = qualifiedOpponents.reduce((worst, current) => {
      const currentWinRate = current.wins / current.total;
      const worstWinRate = worst.wins / worst.total;
      return currentWinRate < worstWinRate ? current : worst;
    });

    return mostFeared.wins / mostFeared.total < 0.5 ? mostFeared : null; // Only show if win rate < 50%
  };

  // Calculate Best Partner (best win rate with in 2v2 matches)
  const getBestPartner = () => {
    const twoVsTwoMatches = userMatches.filter(match => match.matchType === '2v2');

    interface PartnerStats {
      name: string;
      wins: number;
      losses: number;
      total: number;
      avatar: string;
    }

    const rawPartnerStats: Record<string, PartnerStats> = {};

    twoVsTwoMatches.forEach(match => {
      let partner = null;
      let partnerIdentifier = null;

      // New format
      if (
        match.team1?.player1?.id &&
        match.team1?.player2?.id &&
        match.team2?.player1?.id &&
        match.team2?.player2?.id
      ) {
        const isInTeam1 = match.team1.player1.id === user.id || match.team1.player2.id === user.id;
        if (isInTeam1) {
          partner = match.team1.player1.id === user.id ? match.team1.player2 : match.team1.player1;
          partnerIdentifier = partner.id;
        } else {
          partner = match.team2.player1.id === user.id ? match.team2.player2 : match.team2.player1;
          partnerIdentifier = partner.id;
        }
      } else {
        // Legacy format
        const isInTeam1 =
          match.team1Player1Email === userIdentifier ||
          match.team1Player2Email === userIdentifier ||
          match.team1Player1Email === user.email ||
          match.team1Player2Email === user.email;

        if (isInTeam1) {
          const isPlayer1 =
            match.team1Player1Email === userIdentifier || match.team1Player1Email === user.email;
          partnerIdentifier = isPlayer1 ? match.team1Player2Email : match.team1Player1Email;
          partner = { name: isPlayer1 ? match.team1Player2Email : match.team1Player1Email };
        } else {
          const isPlayer1 =
            match.team2Player1Email === userIdentifier || match.team2Player1Email === user.email;
          partnerIdentifier = isPlayer1 ? match.team2Player2Email : match.team2Player1Email;
          partner = { name: isPlayer1 ? match.team2Player2Email : match.team2Player1Email };
        }
      }

      if (partnerIdentifier && partner) {
        const partnerName = partner.name || partnerIdentifier;

        if (!rawPartnerStats[partnerIdentifier]) {
          rawPartnerStats[partnerIdentifier] = {
            name: partnerName,
            wins: 0,
            losses: 0,
            total: 0,
            avatar:
              (partner as any)?.avatar || partnerName?.[0] || partnerIdentifier[0]?.toUpperCase(),
          };
        }

        rawPartnerStats[partnerIdentifier].total++;
        if (isMatchWinner(match)) {
          rawPartnerStats[partnerIdentifier].wins++;
        } else {
          rawPartnerStats[partnerIdentifier].losses++;
        }
      }
    });

    // Consolidate by name to handle duplicates
    const consolidatedPartnerStats: Record<string, PartnerStats> = {};
    Object.values(rawPartnerStats).forEach(stats => {
      const normalizedName = stats.name.toLowerCase().trim();

      if (!consolidatedPartnerStats[normalizedName]) {
        consolidatedPartnerStats[normalizedName] = {
          name: stats.name,
          wins: 0,
          losses: 0,
          total: 0,
          avatar: stats.avatar,
        };
      }

      consolidatedPartnerStats[normalizedName].wins += stats.wins;
      consolidatedPartnerStats[normalizedName].losses += stats.losses;
      consolidatedPartnerStats[normalizedName].total += stats.total;
    });

    // Find partner with best win rate (minimum 3 games)
    const qualifiedPartners = Object.values(consolidatedPartnerStats).filter(
      partner => partner.total >= 3
    );
    if (qualifiedPartners.length === 0) return null;

    const bestPartner = qualifiedPartners.reduce((best, current) => {
      const currentWinRate = current.wins / current.total;
      const bestWinRate = best.wins / best.total;
      return currentWinRate > bestWinRate ? current : best;
    });

    return bestPartner.wins / bestPartner.total > 0.5 ? bestPartner : null; // Only show if win rate > 50%
  };

  const mostFearedOpponent = getMostFearedOpponent();
  const bestPartner = getBestPartner();

  // Get match type counts for filter buttons
  const allUserMatches = matches.filter(match => {
    // Handle 1v1 matches
    if (match.matchType === '1v1' || !match.matchType) {
      // New format
      if (match.player1?.id && match.player2?.id) {
        return match.player1.id === user.id || match.player2.id === user.id;
      }
      // Legacy format
      return (
        match.player1Email === userIdentifier ||
        match.player2Email === userIdentifier ||
        match.player1Email === user.email ||
        match.player2Email === user.email
      );
    }
    // Handle 2v2 matches
    else if (match.matchType === '2v2') {
      // New format
      if (
        match.team1?.player1?.id &&
        match.team1?.player2?.id &&
        match.team2?.player1?.id &&
        match.team2?.player2?.id
      ) {
        return (
          match.team1.player1.id === user.id ||
          match.team1.player2.id === user.id ||
          match.team2.player1.id === user.id ||
          match.team2.player2.id === user.id
        );
      }
      // Legacy format
      return (
        match.team1Player1Email === userIdentifier ||
        match.team1Player2Email === userIdentifier ||
        match.team2Player1Email === userIdentifier ||
        match.team2Player2Email === userIdentifier ||
        match.team1Player1Email === user.email ||
        match.team1Player2Email === user.email ||
        match.team2Player1Email === user.email ||
        match.team2Player2Email === user.email
      );
    }
    return false;
  });

  const singles1v1Count = allUserMatches.filter(
    match => match.matchType === '1v1' || !match.matchType
  ).length;
  const doubles2v2Count = allUserMatches.filter(match => match.matchType === '2v2').length;

  const getMatchTypeDisplayName = () => {
    if (selectedMatchType === '1v1') return '1v1';
    if (selectedMatchType === '2v2') return '2v2';
    return 'All';
  };

  return (
    <div className='p-4 space-y-6'>
      {/* Header */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-6 text-center'>
        <div className='flex items-center justify-center mb-4'>
          <BarChart3 className='w-8 h-8 text-blue-600 mr-3' />
          <div>
            <h2 className='text-2xl text-blue-800'>Your Statistics</h2>
            <p className='text-sm text-blue-600'>
              Performance analytics in {group?.name || 'your group'}
            </p>
          </div>
        </div>
      </div>

      {/* Match Type Filter Cards */}
      <div className='grid grid-cols-3 gap-3'>
        <button
          onClick={() => setSelectedMatchType('all')}
          className={`p-4 rounded-lg text-center transition-all duration-200 ${
            selectedMatchType === 'all'
              ? 'bg-indigo-50 border border-indigo-200 text-indigo-800'
              : 'bg-white border border-gray-200 text-gray-800 hover:shadow-md'
          }`}
        >
          <div className='flex items-center'>
            <Trophy
              className={`w-5 h-5 mr-2 ${
                selectedMatchType === 'all' ? 'text-indigo-600' : 'text-gray-600'
              }`}
            />
            <div>
              <div className='text-sm font-medium'>All Games</div>
              <div
                className={`text-xs ${
                  selectedMatchType === 'all' ? 'text-indigo-600' : 'text-gray-600'
                }`}
              >
                {allUserMatches.length}
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setSelectedMatchType('1v1')}
          className={`p-4 rounded-lg text-center transition-all duration-200 ${
            selectedMatchType === '1v1'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-white border border-gray-200 text-gray-800 hover:shadow-md'
          }`}
        >
          <div className='flex items-center'>
            <User
              className={`w-5 h-5 mr-2 ${
                selectedMatchType === '1v1' ? 'text-emerald-600' : 'text-gray-600'
              }`}
            />
            <div>
              <div className='text-sm font-medium'>1v1</div>
              <div
                className={`text-xs ${
                  selectedMatchType === '1v1' ? 'text-emerald-600' : 'text-gray-600'
                }`}
              >
                {singles1v1Count}
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setSelectedMatchType('2v2')}
          className={`p-4 rounded-lg text-center transition-all duration-200 ${
            selectedMatchType === '2v2'
              ? 'bg-purple-50 border border-purple-200 text-purple-800'
              : 'bg-white border border-gray-200 text-gray-800 hover:shadow-md'
          }`}
        >
          <div className='flex items-center'>
            <Users
              className={`w-5 h-5 mr-2 ${
                selectedMatchType === '2v2' ? 'text-purple-600' : 'text-gray-600'
              }`}
            />
            <div>
              <div className='text-sm font-medium'>2v2</div>
              <div
                className={`text-xs ${
                  selectedMatchType === '2v2' ? 'text-purple-600' : 'text-gray-600'
                }`}
              >
                {doubles2v2Count}
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Filtered Stats Message */}
      {selectedMatchType !== 'all' && (
        <div className='bg-cyan-50 border border-cyan-200 rounded-lg p-4'>
          <div className='flex items-center space-x-3'>
            <BarChart3 className='w-5 h-5 text-cyan-600' />
            <div>
              <p className='text-cyan-800 font-medium'>
                Showing {getMatchTypeDisplayName()} Statistics
              </p>
              <p className='text-cyan-600 text-sm'>{userMatches.length} matches filtered</p>
            </div>
          </div>
        </div>
      )}

      {/* Performance Overview */}
      <div className='bg-orange-50 border border-orange-200 rounded-lg p-6'>
        <div className='flex items-center mb-4'>
          <Target className='w-6 h-6 text-orange-600 mr-3' />
          <h3 className='text-lg text-orange-800'>Performance Overview</h3>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='bg-white border border-orange-100 rounded-lg p-4'>
            <div className='text-2xl text-orange-800'>{actualWins}</div>
            <div className='text-sm text-orange-600'>Wins</div>
          </div>
          <div className='bg-white border border-orange-100 rounded-lg p-4'>
            <div className='text-2xl text-orange-800'>{actualLosses}</div>
            <div className='text-sm text-orange-600'>Losses</div>
          </div>
          <div className='bg-white border border-orange-100 rounded-lg p-4'>
            <div className='text-2xl text-orange-800'>{winRate}%</div>
            <div className='text-sm text-orange-600'>Win Rate</div>
          </div>
          <div className='bg-white border border-orange-100 rounded-lg p-4'>
            <div className='text-2xl text-orange-800'>{totalGames}</div>
            <div className='text-sm text-orange-600'>Total Games</div>
          </div>
        </div>
      </div>

      {/* Current Form */}
      <div className='bg-violet-50 border border-violet-200 rounded-lg p-6'>
        <div className='flex items-center mb-4'>
          <Zap className='w-6 h-6 text-violet-600 mr-3' />
          <h3 className='text-lg text-violet-800'>Current Form</h3>
        </div>

        <div className='space-y-4'>
          {/* Recent Form */}
          <div>
            <h4 className='text-violet-700 text-sm mb-2'>Last 5 Games</h4>
            <div className='flex space-x-2'>
              {recentForm.length > 0 ? (
                recentForm.map((result, index) => (
                  <div
                    key={index}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      result === 'W' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    {result}
                  </div>
                ))
              ) : (
                <div className='text-violet-600 text-sm'>No recent games</div>
              )}
            </div>
          </div>

          {/* Current Streak */}
          <div>
            <h4 className='text-violet-700 text-sm mb-2'>Current Streak</h4>
            <div className='flex items-center space-x-2'>
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  streakType === 'W'
                    ? 'bg-green-500 text-white'
                    : streakType === 'L'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                }`}
              >
                {currentStreak > 0
                  ? `${currentStreak} ${streakType === 'W' ? 'Win' : 'Loss'}${currentStreak > 1 ? 's' : ''}`
                  : 'No streak'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ELO Progress */}
      <div className='bg-teal-50 border border-teal-200 rounded-lg p-6'>
        <div className='flex items-center mb-4'>
          <TrendingUp className='w-6 h-6 text-teal-600 mr-3' />
          <h3 className='text-lg text-teal-800'>ELO Progress</h3>
        </div>

        <div className='grid grid-cols-2 gap-4 mb-4'>
          <div className='bg-white border border-teal-100 rounded-lg p-4'>
            <div className='text-2xl text-teal-800'>{currentFilteredElo}</div>
            <div className='text-sm text-teal-600'>
              Current{' '}
              {selectedMatchType === '1v1' ? '1v1' : selectedMatchType === '2v2' ? '2v2' : ''} ELO
            </div>
          </div>
          <div className='bg-white border border-teal-100 rounded-lg p-4'>
            <div className={`text-2xl ${totalEloChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalEloChange >= 0 ? '+' : ''}
              {totalEloChange}
            </div>
            <div className='text-sm text-teal-600'>Total Change</div>
          </div>
          <div className='bg-white border border-teal-100 rounded-lg p-4'>
            <div className='text-2xl text-teal-800'>{highestElo}</div>
            <div className='text-sm text-teal-600'>
              Peak {selectedMatchType === '1v1' ? '1v1' : selectedMatchType === '2v2' ? '2v2' : ''}{' '}
              ELO
            </div>
          </div>
          <div className='bg-white border border-teal-100 rounded-lg p-4'>
            <div
              className={`text-2xl ${
                parseFloat(averageEloChange) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {parseFloat(averageEloChange) >= 0 ? '+' : ''}
              {averageEloChange}
            </div>
            <div className='text-sm text-teal-600'>Avg per Game</div>
          </div>
        </div>

        {/* ELO Timeline Chart */}
        {eloTimelineData.length > 1 && (
          <div className='bg-white border border-teal-100 rounded-lg p-4'>
            <h4 className='text-teal-700 text-sm mb-3'>ELO Timeline</h4>
            <div className='h-40'>
              {eloTimelineData.length > 0 ? (
                <EloChart data={eloTimelineData} />
              ) : (
                <div className='flex items-center justify-center h-full text-gray-500'>
                  <p className='text-sm'>No ELO data available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Best Partner & Most Feared Opponent */}
      <div className='grid grid-cols-1 gap-4'>
        {/* Best Partner */}
        {bestPartner && (
          <div className='bg-green-50 border border-green-200 rounded-lg p-6'>
            <div className='flex items-center mb-4'>
              <Heart className='w-6 h-6 text-green-600 mr-3' />
              <h3 className='text-lg text-green-800'>Best Partner</h3>
            </div>

            <div className='flex items-center space-x-4'>
              <div className='w-16 h-16 bg-white border border-green-200 rounded-full flex items-center justify-center overflow-hidden'>
                <Avatar
                  src={undefined}
                  fallback={bestPartner.avatar}
                  className='w-full h-full rounded-full'
                  textClassName='text-xl text-green-600'
                />
              </div>
              <div className='flex-1'>
                <h4 className='text-xl text-green-800'>{bestPartner.name}</h4>
                <p className='text-green-600 text-sm mb-2'>
                  Win rate: {((bestPartner.wins / bestPartner.total) * 100).toFixed(1)}%
                </p>
                <p className='text-green-700 text-xs'>
                  {bestPartner.wins}W - {bestPartner.losses}L ({bestPartner.total} games)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Most Feared Opponent */}
        {mostFearedOpponent && (
          <div className='bg-gray-50 border border-gray-200 rounded-lg p-6'>
            <div className='flex items-center mb-4'>
              <Skull className='w-6 h-6 text-gray-600 mr-3' />
              <h3 className='text-lg text-gray-800'>Most Feared Opponent</h3>
            </div>

            <div className='flex items-center space-x-4'>
              <div className='w-16 h-16 bg-white border border-gray-200 rounded-full flex items-center justify-center overflow-hidden'>
                <Avatar
                  src={undefined}
                  fallback={mostFearedOpponent.avatar}
                  className='w-full h-full rounded-full'
                  textClassName='text-xl text-gray-600'
                />
              </div>
              <div className='flex-1'>
                <h4 className='text-xl text-gray-800'>{mostFearedOpponent.name}</h4>
                <p className='text-gray-600 text-sm mb-2'>
                  Your win rate:{' '}
                  {((mostFearedOpponent.wins / mostFearedOpponent.total) * 100).toFixed(1)}%
                </p>
                <p className='text-gray-700 text-xs'>
                  {mostFearedOpponent.wins}W - {mostFearedOpponent.losses}L (
                  {mostFearedOpponent.total} games)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No special stats message */}
        {!bestPartner && !mostFearedOpponent && (
          <div className='bg-gray-50 border border-gray-200 rounded-lg p-8 text-center'>
            <div className='flex items-center justify-center space-x-4 mb-4'>
              <Skull className='w-6 h-6 text-gray-600' />
              <Heart className='w-6 h-6 text-gray-600' />
            </div>
            <h3 className='text-gray-800 mb-2'>Special Statistics</h3>
            <p className='text-gray-700 text-sm mb-2'>
              Play more matches to unlock your Most Feared Opponent and Best Partner stats!
            </p>
            <p className='text-gray-600 text-xs'>
              (Minimum 3 matches required with specific opponents/partners)
            </p>
          </div>
        )}
      </div>

      {/* Head-to-Head Records */}
      <div className='bg-gray-50 border border-gray-200 rounded-lg p-6'>
        <div className='flex items-center mb-4'>
          <Award className='w-6 h-6 text-blue-600 mr-3' />
          <h3 className='text-lg text-gray-800'>Head-to-Head Records</h3>
        </div>

        <div className='space-y-3'>
          {opponentList.length > 0 ? (
            opponentList.map((opponent, index) => (
              <div
                key={index}
                className='bg-white border border-gray-100 rounded-lg p-3 flex items-center justify-between'
              >
                <div className='flex items-center space-x-3'>
                  <div className='w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm text-gray-600'>
                    {index + 1}
                  </div>
                  <div>
                    <div className='text-gray-800'>{opponent.name}</div>
                    <div className='text-gray-600 text-xs'>
                      {opponent.wins}W - {opponent.losses}L
                    </div>
                  </div>
                </div>
                <div className='text-right'>
                  <div className='text-gray-800'>
                    {((opponent.wins / opponent.total) * 100).toFixed(0)}%
                  </div>
                  <div className='text-gray-600 text-xs'>{opponent.total} games</div>
                </div>
              </div>
            ))
          ) : (
            <div className='text-gray-600 text-center py-4'>No head-to-head records available</div>
          )}
        </div>
      </div>

      {/* Monthly Performance */}
      <div className='bg-amber-50 border border-amber-200 rounded-lg p-6'>
        <div className='flex items-center mb-4'>
          <Calendar className='w-6 h-6 text-amber-600 mr-3' />
          <h3 className='text-lg text-amber-800'>Monthly Performance</h3>
        </div>

        <div className='space-y-3'>
          {monthlyStats.length > 0 ? (
            monthlyStats.map(([month, stats]) => {
              const monthTotal = stats.wins + stats.losses;
              const monthWinRate =
                monthTotal > 0 ? ((stats.wins / monthTotal) * 100).toFixed(1) : '0';
              const monthName = new Date(`${month}-01`).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              });

              return (
                <div key={month} className='bg-white border border-amber-100 rounded-lg p-3'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='text-amber-800'>{monthName}</div>
                    <div className='text-amber-600 text-sm'>{monthWinRate}% win rate</div>
                  </div>
                  <div className='flex items-center space-x-4 text-sm'>
                    <div className='text-amber-700'>
                      {stats.wins}W - {stats.losses}L
                    </div>
                    <div className='text-amber-600'>{monthTotal} games</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className='text-amber-600 text-center py-4'>No monthly data available</div>
          )}
        </div>
      </div>
    </div>
  );
}
