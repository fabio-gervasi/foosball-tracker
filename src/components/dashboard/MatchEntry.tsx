import React, { useState } from 'react';
import { Users, Trophy, Save, User as UserIcon, UserCheck } from 'lucide-react';
import type { User, MatchSubmissionData } from '../../types';

interface MatchEntryProps {
  users: User[];
  onMatchSubmit: (matchData: MatchSubmissionData) => Promise<any>;
}

// Guest players for the dropdowns
const GUEST_PLAYERS = [
  { id: 'guest1', name: 'Guest 1', isGuest: true },
  { id: 'guest2', name: 'Guest 2', isGuest: true },
  { id: 'guest3', name: 'Guest 3', isGuest: true },
  { id: 'guest4', name: 'Guest 4', isGuest: true },
];

export function MatchEntry({ users, onMatchSubmit }: MatchEntryProps) {
  const [matchType, setMatchType] = useState<'1v1' | '2v2'>('1v1');
  const [seriesType, setSeriesType] = useState<'bo1' | 'bo3'>('bo1');

  // 1v1 state
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [winnerId, setWinnerId] = useState('');

  // 2v2 state
  const [team1Player1, setTeam1Player1] = useState('');
  const [team1Player2, setTeam1Player2] = useState('');
  const [team2Player1, setTeam2Player1] = useState('');
  const [team2Player2, setTeam2Player2] = useState('');
  const [winningTeam, setWinningTeam] = useState<1 | 2 | null>(null);

  // Best of 3 state
  const [game1Winner, setGame1Winner] = useState<string | null>(null);
  const [game2Winner, setGame2Winner] = useState<string | null>(null);
  const [game3Winner, setGame3Winner] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Combine regular users with guest players for the dropdowns
  const allPlayers = [...users, ...GUEST_PLAYERS];

  const resetForm = () => {
    setPlayer1Id('');
    setPlayer2Id('');
    setWinnerId('');
    setTeam1Player1('');
    setTeam1Player2('');
    setTeam2Player1('');
    setTeam2Player2('');
    setWinningTeam(null);
    setGame1Winner(null);
    setGame2Winner(null);
    setGame3Winner(null);
    setError('');
  };

  const handleMatchTypeChange = (type: '1v1' | '2v2') => {
    setMatchType(type);
    resetForm();
  };

  const handleSeriesTypeChange = (type: 'bo1' | 'bo3') => {
    setSeriesType(type);
    setWinnerId('');
    setWinningTeam(null);
    setGame1Winner(null);
    setGame2Winner(null);
    setGame3Winner(null);
  };

  // Helper functions for Best of 3
  const getOverallWinner = () => {
    if (seriesType === 'bo1') return null;

    const games = [game1Winner, game2Winner, game3Winner].filter(w => w !== null);
    if (games.length < 2) return null;

    const player1Wins = games.filter(w => w === (matchType === '1v1' ? player1Id : 'team1')).length;
    const player2Wins = games.filter(w => w === (matchType === '1v1' ? player2Id : 'team2')).length;

    if (player1Wins >= 2) return matchType === '1v1' ? player1Id : 'team1';
    if (player2Wins >= 2) return matchType === '1v1' ? player2Id : 'team2';

    return null;
  };

  const isSeriesComplete = () => {
    if (seriesType === 'bo1') return false;
    return getOverallWinner() !== null;
  };

  const getSeriesScore = () => {
    if (seriesType === 'bo1') return null;

    const games = [game1Winner, game2Winner, game3Winner];
    const player1Wins = games.filter(w => w === (matchType === '1v1' ? player1Id : 'team1')).length;
    const player2Wins = games.filter(w => w === (matchType === '1v1' ? player2Id : 'team2')).length;

    return { player1Wins, player2Wins };
  };

  const isGuestPlayer = (playerId: string) => {
    return playerId.startsWith('guest');
  };

  const getPlayerName = (playerId: string) => {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return '';
    // For User objects, try username first, then name. For guest players, use name directly.
    return 'username' in player ? player.username || player.name : player.name;
  };

  const getPlayerIdentifier = (playerId: string) => {
    if (isGuestPlayer(playerId)) {
      return playerId; // For guest players, use the guest ID as identifier
    }
    const player = users.find(u => u.id === playerId);
    return player ? player.username || player.email || '' : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (matchType === '1v1') {
      if (!player1Id || !player2Id) {
        setError('Please select both players');
        return;
      }

      if (player1Id === player2Id) {
        setError('Please select different players');
        return;
      }

      // Validation for Best of 1 vs Best of 3
      if (seriesType === 'bo1') {
        if (!winnerId) {
          setError('Please select the winner');
          return;
        }

        if (winnerId !== player1Id && winnerId !== player2Id) {
          setError('Winner must be one of the selected players');
          return;
        }
      } else {
        // Best of 3 validation
        if (!isSeriesComplete()) {
          setError('Please complete the Best of 3 series (play until one player wins 2 games)');
          return;
        }
      }

      setIsSubmitting(true);

      try {
        const player1Identifier = getPlayerIdentifier(player1Id);
        const player2Identifier = getPlayerIdentifier(player2Id);

        let matchData: MatchSubmissionData;

        if (seriesType === 'bo1') {
          const winnerIdentifier = getPlayerIdentifier(winnerId);
          matchData = {
            matchType: '1v1',
            seriesType,
            player1Email: player1Identifier,
            player2Email: player2Identifier,
            player1IsGuest: isGuestPlayer(player1Id),
            player2IsGuest: isGuestPlayer(player2Id),
            winner: {
              id: winnerId,
              name: getPlayerName(winnerId),
              email: winnerIdentifier,
              isGuest: isGuestPlayer(winnerId),
            },
            score1: winnerId === player1Id ? 1 : 0,
            score2: winnerId === player2Id ? 1 : 0,
            groupId: '',
            createdAt: new Date().toISOString(),
            date: new Date().toISOString(),
          };
        } else {
          // Best of 3 data
          const overallWinner = getOverallWinner();
          const winnerIdentifier = overallWinner ? getPlayerIdentifier(overallWinner) : '';
          const seriesScore = getSeriesScore();

          matchData = {
            matchType: '1v1',
            seriesType,
            player1Email: player1Identifier,
            player2Email: player2Identifier,
            player1IsGuest: isGuestPlayer(player1Id),
            player2IsGuest: isGuestPlayer(player2Id),
            winner: {
              id: overallWinner || '',
              name: overallWinner ? getPlayerName(overallWinner) : '',
              email: winnerIdentifier,
              isGuest: overallWinner ? isGuestPlayer(overallWinner) : false,
            },
            score1: seriesScore ? seriesScore.player1Wins : 0,
            score2: seriesScore ? seriesScore.player2Wins : 0,
            groupId: '',
            createdAt: new Date().toISOString(),
            gameResults: [
              game1Winner === player1Id ? 'player1' : 'player2',
              game2Winner === player1Id ? 'player1' : 'player2',
              game3Winner ? (game3Winner === player1Id ? 'player1' : 'player2') : null,
            ].filter(g => g !== null) as string[],
            seriesScore: seriesScore
              ? `${seriesScore.player1Wins}-${seriesScore.player2Wins}`
              : '0-0',
            isSweep: seriesScore
              ? (seriesScore.player1Wins === 2 && seriesScore.player2Wins === 0) ||
                (seriesScore.player2Wins === 2 && seriesScore.player1Wins === 0)
              : false,
            date: new Date().toISOString(),
          };
        }

        await onMatchSubmit(matchData);

        resetForm();
      } catch (error) {
        console.error('Match submission error:', error);
        setError(
          error instanceof Error ? error.message : 'Error recording match. Please try again.'
        );
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // 2v2 validation
      const allPlayers = [team1Player1, team1Player2, team2Player1, team2Player2];

      if (allPlayers.some(p => !p)) {
        setError('Please select all 4 players');
        return;
      }

      if (new Set(allPlayers).size !== 4) {
        setError('All players must be different');
        return;
      }

      // Validation for Best of 1 vs Best of 3
      if (seriesType === 'bo1') {
        if (!winningTeam) {
          setError('Please select the winning team');
          return;
        }
      } else {
        // Best of 3 validation
        if (!isSeriesComplete()) {
          setError('Please complete the Best of 3 series (play until one team wins 2 games)');
          return;
        }
      }

      setIsSubmitting(true);

      try {
        let matchData: MatchSubmissionData;

        if (seriesType === 'bo1') {
          matchData = {
            matchType: '2v2',
            seriesType,
            team1Player1Email: getPlayerIdentifier(team1Player1),
            team1Player2Email: getPlayerIdentifier(team1Player2),
            team2Player1Email: getPlayerIdentifier(team2Player1),
            team2Player2Email: getPlayerIdentifier(team2Player2),
            team1Player1IsGuest: isGuestPlayer(team1Player1),
            team1Player2IsGuest: isGuestPlayer(team1Player2),
            team2Player1IsGuest: isGuestPlayer(team2Player1),
            team2Player2IsGuest: isGuestPlayer(team2Player2),
            winningTeam: winningTeam === 1 ? 'team1' : 'team2',
            score1: winningTeam === 1 ? 1 : 0,
            score2: winningTeam === 2 ? 1 : 0,
            groupId: '',
            createdAt: new Date().toISOString(),
            date: new Date().toISOString(),
          };
        } else {
          // Best of 3 data
          const overallWinner = getOverallWinner();
          const seriesScore = getSeriesScore();

          matchData = {
            matchType: '2v2',
            seriesType,
            team1Player1Email: getPlayerIdentifier(team1Player1),
            team1Player2Email: getPlayerIdentifier(team1Player2),
            team2Player1Email: getPlayerIdentifier(team2Player1),
            team2Player2Email: getPlayerIdentifier(team2Player2),
            team1Player1IsGuest: isGuestPlayer(team1Player1),
            team1Player2IsGuest: isGuestPlayer(team1Player2),
            team2Player1IsGuest: isGuestPlayer(team2Player1),
            team2Player2IsGuest: isGuestPlayer(team2Player2),
            winningTeam: overallWinner,
            score1: seriesScore ? seriesScore.player1Wins : 0,
            score2: seriesScore ? seriesScore.player2Wins : 0,
            groupId: '',
            createdAt: new Date().toISOString(),
            gameResults: [game1Winner, game2Winner, game3Winner].filter(
              g => g !== null
            ) as string[],
            seriesScore: seriesScore
              ? `${seriesScore.player1Wins}-${seriesScore.player2Wins}`
              : '0-0',
            isSweep: seriesScore
              ? (seriesScore.player1Wins === 2 && seriesScore.player2Wins === 0) ||
                (seriesScore.player2Wins === 2 && seriesScore.player1Wins === 0)
              : false,
            date: new Date().toISOString(),
          };
        }

        await onMatchSubmit(matchData);

        resetForm();
      } catch (error) {
        console.error('Match submission error:', error);
        setError(
          error instanceof Error ? error.message : 'Error recording match. Please try again.'
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const bothPlayersSelected = player1Id && player2Id && player1Id !== player2Id;
  const allPlayersSelected2v2 = team1Player1 && team1Player2 && team2Player1 && team2Player2;
  const allPlayersDifferent2v2 =
    new Set([team1Player1, team1Player2, team2Player1, team2Player2]).size === 4;

  return (
    <div className='p-4 space-y-6'>
      <div className='text-center py-4'>
        <Users className='w-16 h-16 text-blue-600 mx-auto mb-4' />
        <h2 className='text-2xl text-gray-800'>Record Match</h2>
        <p className='text-gray-600'>Enter the result of your foosball match</p>
      </div>

      {/* Match Type Selection */}
      <div className='bg-white rounded-lg border border-gray-200 p-4'>
        <h3 className='text-lg text-gray-800 mb-4'>Match Type</h3>
        <div className='grid grid-cols-2 gap-4'>
          <button
            type='button'
            onClick={() => handleMatchTypeChange('1v1')}
            className={`p-4 rounded-lg border-2 transition-all ${
              matchType === '1v1'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <div className='flex flex-col items-center space-y-2'>
              <UserIcon className='w-8 h-8' />
              <span>1v1 Singles</span>
              <span className='text-xs text-gray-500'>One vs One</span>
            </div>
          </button>

          <button
            type='button'
            onClick={() => handleMatchTypeChange('2v2')}
            className={`p-4 rounded-lg border-2 transition-all ${
              matchType === '2v2'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <div className='flex flex-col items-center space-y-2'>
              <Users className='w-8 h-8' />
              <span>2v2 Doubles</span>
              <span className='text-xs text-gray-500'>Team vs Team</span>
            </div>
          </button>
        </div>
      </div>

      {/* Series Type Selection */}
      <div className='bg-white rounded-lg border border-gray-200 p-4'>
        <h3 className='text-lg text-gray-800 mb-4'>Series Format</h3>
        <div className='grid grid-cols-2 gap-4'>
          <button
            type='button'
            onClick={() => handleSeriesTypeChange('bo1')}
            className={`p-4 rounded-lg border-2 transition-all ${
              seriesType === 'bo1'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
            }`}
          >
            <div className='flex flex-col items-center space-y-2'>
              <Trophy className='w-8 h-8' />
              <span>Best of 1</span>
              <span className='text-xs text-gray-500'>Single Game</span>
            </div>
          </button>

          <button
            type='button'
            onClick={() => handleSeriesTypeChange('bo3')}
            className={`p-4 rounded-lg border-2 transition-all ${
              seriesType === 'bo3'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
            }`}
          >
            <div className='flex flex-col items-center space-y-2'>
              <Trophy className='w-8 h-8' />
              <span>Best of 3</span>
              <span className='text-xs text-gray-500'>First to 2 wins</span>
            </div>
          </button>
        </div>

        {seriesType === 'bo3' && (
          <div className='mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg'>
            <div className='flex items-center space-x-2'>
              <Trophy className='w-4 h-4 text-yellow-600' />
              <span className='text-sm text-yellow-800'>
                <strong>2-0 Bonus:</strong> Winning 2-0 gives 1.2x ELO points!
              </span>
            </div>
          </div>
        )}

        {matchType === '2v2' && (
          <div className='mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg'>
            <div className='flex items-center space-x-2'>
              <Users className='w-4 h-4 text-blue-600' />
              <span className='text-sm text-blue-800'>
                <strong>Advanced 2v2 ELO:</strong> Individual player ratings calculated based on
                personal performance vs each opponent!
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {matchType === '1v1' ? (
          /* 1v1 Player Selection */
          <div className='bg-white rounded-lg border border-gray-200 p-4'>
            <h3 className='text-lg text-gray-800 mb-4'>Select Players</h3>

            <div className='space-y-4'>
              <div>
                <label className='block text-gray-700 text-sm mb-2'>Player 1</label>
                <select
                  value={player1Id}
                  onChange={e => {
                    setPlayer1Id(e.target.value);
                    setWinnerId(''); // Reset winner when players change
                  }}
                  className='w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  disabled={isSubmitting}
                >
                  <option value=''>Select Player 1</option>
                  <optgroup label='Players'>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.username || user.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label='Guests'>
                    {GUEST_PLAYERS.map(guest => (
                      <option key={guest.id} value={guest.id}>
                        {guest.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className='block text-gray-700 text-sm mb-2'>Player 2</label>
                <select
                  value={player2Id}
                  onChange={e => {
                    setPlayer2Id(e.target.value);
                    setWinnerId(''); // Reset winner when players change
                  }}
                  className='w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  disabled={isSubmitting}
                >
                  <option value=''>Select Player 2</option>
                  <optgroup label='Players'>
                    {users
                      .filter(user => user.id !== player1Id)
                      .map(user => (
                        <option key={user.id} value={user.id}>
                          {user.username || user.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label='Guests'>
                    {GUEST_PLAYERS.filter(guest => guest.id !== player1Id).map(guest => (
                      <option key={guest.id} value={guest.id}>
                        {guest.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>
        ) : (
          /* 2v2 Team Selection */
          <div className='bg-white rounded-lg border border-gray-200 p-4'>
            <h3 className='text-lg text-gray-800 mb-4'>Select Teams</h3>

            <div className='space-y-6'>
              {/* Team 1 */}
              <div>
                <h4 className='text-md text-gray-700 mb-3 flex items-center'>
                  <UserCheck className='w-5 h-5 mr-2 text-blue-600' />
                  Team 1
                </h4>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-gray-700 text-xs mb-2'>Player 1</label>
                    <select
                      value={team1Player1}
                      onChange={e => {
                        setTeam1Player1(e.target.value);
                        setWinningTeam(null);
                      }}
                      className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
                      disabled={isSubmitting}
                    >
                      <option value=''>Select Player</option>
                      <optgroup label='Players'>
                        {users
                          .filter(
                            user => ![team1Player2, team2Player1, team2Player2].includes(user.id)
                          )
                          .map(user => (
                            <option key={user.id} value={user.id}>
                              {user.username || user.name}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label='Guests'>
                        {GUEST_PLAYERS.filter(
                          guest => ![team1Player2, team2Player1, team2Player2].includes(guest.id)
                        ).map(guest => (
                          <option key={guest.id} value={guest.id}>
                            {guest.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className='block text-gray-700 text-xs mb-2'>Player 2</label>
                    <select
                      value={team1Player2}
                      onChange={e => {
                        setTeam1Player2(e.target.value);
                        setWinningTeam(null);
                      }}
                      className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
                      disabled={isSubmitting}
                    >
                      <option value=''>Select Player</option>
                      <optgroup label='Players'>
                        {users
                          .filter(
                            user => ![team1Player1, team2Player1, team2Player2].includes(user.id)
                          )
                          .map(user => (
                            <option key={user.id} value={user.id}>
                              {user.username || user.name}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label='Guests'>
                        {GUEST_PLAYERS.filter(
                          guest => ![team1Player1, team2Player1, team2Player2].includes(guest.id)
                        ).map(guest => (
                          <option key={guest.id} value={guest.id}>
                            {guest.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              </div>

              {/* Team 2 */}
              <div>
                <h4 className='text-md text-gray-700 mb-3 flex items-center'>
                  <UserCheck className='w-5 h-5 mr-2 text-red-600' />
                  Team 2
                </h4>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-gray-700 text-xs mb-2'>Player 1</label>
                    <select
                      value={team2Player1}
                      onChange={e => {
                        setTeam2Player1(e.target.value);
                        setWinningTeam(null);
                      }}
                      className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
                      disabled={isSubmitting}
                    >
                      <option value=''>Select Player</option>
                      <optgroup label='Players'>
                        {users
                          .filter(
                            user => ![team1Player1, team1Player2, team2Player2].includes(user.id)
                          )
                          .map(user => (
                            <option key={user.id} value={user.id}>
                              {user.username || user.name}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label='Guests'>
                        {GUEST_PLAYERS.filter(
                          guest => ![team1Player1, team1Player2, team2Player2].includes(guest.id)
                        ).map(guest => (
                          <option key={guest.id} value={guest.id}>
                            {guest.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className='block text-gray-700 text-xs mb-2'>Player 2</label>
                    <select
                      value={team2Player2}
                      onChange={e => {
                        setTeam2Player2(e.target.value);
                        setWinningTeam(null);
                      }}
                      className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
                      disabled={isSubmitting}
                    >
                      <option value=''>Select Player</option>
                      <optgroup label='Players'>
                        {users
                          .filter(
                            user => ![team1Player1, team1Player2, team2Player1].includes(user.id)
                          )
                          .map(user => (
                            <option key={user.id} value={user.id}>
                              {user.username || user.name}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label='Guests'>
                        {GUEST_PLAYERS.filter(
                          guest => ![team1Player1, team1Player2, team2Player1].includes(guest.id)
                        ).map(guest => (
                          <option key={guest.id} value={guest.id}>
                            {guest.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Winner Selection */}
        {(matchType === '1v1' && bothPlayersSelected) ||
        (matchType === '2v2' && allPlayersSelected2v2 && allPlayersDifferent2v2) ? (
          <div className='bg-white rounded-lg border border-gray-200 p-4'>
            <h3 className='text-lg text-gray-800 mb-4'>
              {seriesType === 'bo1' ? 'Match Result' : 'Series Results'}
            </h3>
            {seriesType === 'bo1' ? (
              <p className='text-gray-600 mb-4'>
                {matchType === '1v1' ? 'Who won the match?' : 'Which team won the match?'}
              </p>
            ) : (
              <div className='mb-4'>
                <p className='text-gray-600 mb-2'>Record each game result (first to 2 wins):</p>
                {isSeriesComplete() && (
                  <div className='flex items-center space-x-2 bg-green-50 text-green-800 px-3 py-2 rounded-lg mb-4'>
                    <Trophy className='w-4 h-4' />
                    <span className='text-sm'>
                      Series Complete!{' '}
                      {matchType === '1v1'
                        ? getOverallWinner()
                          ? getPlayerName(getOverallWinner()!)
                          : 'Unknown'
                        : `Team ${getOverallWinner() === 'team1' ? '1' : '2'}`}{' '}
                      wins {getSeriesScore()?.player1Wins || 0}-{getSeriesScore()?.player2Wins || 0}
                      {getSeriesScore()?.player1Wins === 2 && getSeriesScore()?.player2Wins === 0
                        ? ' (2-0 Sweep - 1.2x ELO!)'
                        : getSeriesScore()?.player2Wins === 2 && getSeriesScore()?.player1Wins === 0
                          ? ' (2-0 Sweep - 1.2x ELO!)'
                          : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {seriesType === 'bo1' ? (
              // Best of 1 - Single winner selection
              <div className='grid grid-cols-2 gap-4'>
                {matchType === '1v1' ? (
                  <>
                    {/* 1v1 Winner Buttons */}
                    <button
                      type='button'
                      onClick={() => setWinnerId(player1Id)}
                      disabled={isSubmitting}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        winnerId === player1Id
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      <div className='flex flex-col items-center space-y-2'>
                        {winnerId === player1Id && <Trophy className='w-6 h-6 text-green-600' />}
                        <span className='text-center'>
                          {getPlayerName(player1Id)}
                          {isGuestPlayer(player1Id) && (
                            <span className='text-xs text-gray-500 ml-1'>(Guest)</span>
                          )}
                        </span>
                        {winnerId === player1Id && (
                          <span className='text-sm text-green-600'>Winner!</span>
                        )}
                      </div>
                    </button>

                    <button
                      type='button'
                      onClick={() => setWinnerId(player2Id)}
                      disabled={isSubmitting}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        winnerId === player2Id
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      <div className='flex flex-col items-center space-y-2'>
                        {winnerId === player2Id && <Trophy className='w-6 h-6 text-green-600' />}
                        <span className='text-center'>
                          {getPlayerName(player2Id)}
                          {isGuestPlayer(player2Id) && (
                            <span className='text-xs text-gray-500 ml-1'>(Guest)</span>
                          )}
                        </span>
                        {winnerId === player2Id && (
                          <span className='text-sm text-green-600'>Winner!</span>
                        )}
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    {/* 2v2 Team Winner Buttons */}
                    <button
                      type='button'
                      onClick={() => setWinningTeam(1)}
                      disabled={isSubmitting}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        winningTeam === 1
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      <div className='flex flex-col items-center space-y-2'>
                        {winningTeam === 1 && <Trophy className='w-6 h-6 text-green-600' />}
                        <span className='text-center'>Team 1</span>
                        <div className='text-xs text-gray-600'>{getPlayerName(team1Player1)} &</div>
                        <div className='text-xs text-gray-600'>{getPlayerName(team1Player2)}</div>
                        {winningTeam === 1 && (
                          <span className='text-sm text-green-600'>Winners!</span>
                        )}
                      </div>
                    </button>

                    <button
                      type='button'
                      onClick={() => setWinningTeam(2)}
                      disabled={isSubmitting}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        winningTeam === 2
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      <div className='flex flex-col items-center space-y-2'>
                        {winningTeam === 2 && <Trophy className='w-6 h-6 text-green-600' />}
                        <span className='text-center'>Team 2</span>
                        <div className='text-xs text-gray-600'>{getPlayerName(team2Player1)} &</div>
                        <div className='text-xs text-gray-600'>{getPlayerName(team2Player2)}</div>
                        {winningTeam === 2 && (
                          <span className='text-sm text-green-600'>Winners!</span>
                        )}
                      </div>
                    </button>
                  </>
                )}
              </div>
            ) : (
              // Best of 3 - Game by game selection
              <div className='space-y-4'>
                {/* Game 1 */}
                <div className='border border-gray-200 rounded-lg p-4'>
                  <h4 className='text-md text-gray-700 mb-3 flex items-center'>
                    <Trophy className='w-4 h-4 mr-2 text-blue-600' />
                    Game 1 Winner
                  </h4>
                  <div className='grid grid-cols-2 gap-4'>
                    {matchType === '1v1' ? (
                      <>
                        <button
                          type='button'
                          onClick={() => setGame1Winner(player1Id)}
                          disabled={isSubmitting}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${
                            game1Winner === player1Id
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          <div className='text-center'>
                            <div>{getPlayerName(player1Id)}</div>
                            {game1Winner === player1Id && (
                              <div className='text-xs text-blue-600 mt-1'>Won Game 1</div>
                            )}
                          </div>
                        </button>
                        <button
                          type='button'
                          onClick={() => setGame1Winner(player2Id)}
                          disabled={isSubmitting}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${
                            game1Winner === player2Id
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          <div className='text-center'>
                            <div>{getPlayerName(player2Id)}</div>
                            {game1Winner === player2Id && (
                              <div className='text-xs text-blue-600 mt-1'>Won Game 1</div>
                            )}
                          </div>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type='button'
                          onClick={() => setGame1Winner('team1')}
                          disabled={isSubmitting}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${
                            game1Winner === 'team1'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          <div className='text-center'>
                            <div>Team 1</div>
                            <div className='text-xs text-gray-600'>
                              {getPlayerName(team1Player1)} & {getPlayerName(team1Player2)}
                            </div>
                            {game1Winner === 'team1' && (
                              <div className='text-xs text-blue-600 mt-1'>Won Game 1</div>
                            )}
                          </div>
                        </button>
                        <button
                          type='button'
                          onClick={() => setGame1Winner('team2')}
                          disabled={isSubmitting}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${
                            game1Winner === 'team2'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          <div className='text-center'>
                            <div>Team 2</div>
                            <div className='text-xs text-gray-600'>
                              {getPlayerName(team2Player1)} & {getPlayerName(team2Player2)}
                            </div>
                            {game1Winner === 'team2' && (
                              <div className='text-xs text-blue-600 mt-1'>Won Game 1</div>
                            )}
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Game 2 - Only show if Game 1 is complete */}
                {game1Winner && (
                  <div className='border border-gray-200 rounded-lg p-4'>
                    <h4 className='text-md text-gray-700 mb-3 flex items-center'>
                      <Trophy className='w-4 h-4 mr-2 text-green-600' />
                      Game 2 Winner
                    </h4>
                    <div className='grid grid-cols-2 gap-4'>
                      {matchType === '1v1' ? (
                        <>
                          <button
                            type='button'
                            onClick={() => setGame2Winner(player1Id)}
                            disabled={isSubmitting}
                            className={`p-3 rounded-lg border-2 transition-all text-sm ${
                              game2Winner === player1Id
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                            }`}
                          >
                            <div className='text-center'>
                              <div>{getPlayerName(player1Id)}</div>
                              {game2Winner === player1Id && (
                                <div className='text-xs text-green-600 mt-1'>Won Game 2</div>
                              )}
                            </div>
                          </button>
                          <button
                            type='button'
                            onClick={() => setGame2Winner(player2Id)}
                            disabled={isSubmitting}
                            className={`p-3 rounded-lg border-2 transition-all text-sm ${
                              game2Winner === player2Id
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                            }`}
                          >
                            <div className='text-center'>
                              <div>{getPlayerName(player2Id)}</div>
                              {game2Winner === player2Id && (
                                <div className='text-xs text-green-600 mt-1'>Won Game 2</div>
                              )}
                            </div>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type='button'
                            onClick={() => setGame2Winner('team1')}
                            disabled={isSubmitting}
                            className={`p-3 rounded-lg border-2 transition-all text-sm ${
                              game2Winner === 'team1'
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                            }`}
                          >
                            <div className='text-center'>
                              <div>Team 1</div>
                              <div className='text-xs text-gray-600'>
                                {getPlayerName(team1Player1)} & {getPlayerName(team1Player2)}
                              </div>
                              {game2Winner === 'team1' && (
                                <div className='text-xs text-green-600 mt-1'>Won Game 2</div>
                              )}
                            </div>
                          </button>
                          <button
                            type='button'
                            onClick={() => setGame2Winner('team2')}
                            disabled={isSubmitting}
                            className={`p-3 rounded-lg border-2 transition-all text-sm ${
                              game2Winner === 'team2'
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                            }`}
                          >
                            <div className='text-center'>
                              <div>Team 2</div>
                              <div className='text-xs text-gray-600'>
                                {getPlayerName(team2Player1)} & {getPlayerName(team2Player2)}
                              </div>
                              {game2Winner === 'team2' && (
                                <div className='text-xs text-green-600 mt-1'>Won Game 2</div>
                              )}
                            </div>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Game 3 - Only show if games are tied 1-1 */}
                {game1Winner && game2Winner && !isSeriesComplete() && (
                  <div className='border border-gray-200 rounded-lg p-4'>
                    <h4 className='text-md text-gray-700 mb-3 flex items-center'>
                      <Trophy className='w-4 h-4 mr-2 text-yellow-600' />
                      Game 3 Winner (Tiebreaker)
                    </h4>
                    <div className='grid grid-cols-2 gap-4'>
                      {matchType === '1v1' ? (
                        <>
                          <button
                            type='button'
                            onClick={() => setGame3Winner(player1Id)}
                            disabled={isSubmitting}
                            className={`p-3 rounded-lg border-2 transition-all text-sm ${
                              game3Winner === player1Id
                                ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                                : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
                            }`}
                          >
                            <div className='text-center'>
                              <div>{getPlayerName(player1Id)}</div>
                              {game3Winner === player1Id && (
                                <div className='text-xs text-yellow-600 mt-1'>Won Game 3</div>
                              )}
                            </div>
                          </button>
                          <button
                            type='button'
                            onClick={() => setGame3Winner(player2Id)}
                            disabled={isSubmitting}
                            className={`p-3 rounded-lg border-2 transition-all text-sm ${
                              game3Winner === player2Id
                                ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                                : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
                            }`}
                          >
                            <div className='text-center'>
                              <div>{getPlayerName(player2Id)}</div>
                              {game3Winner === player2Id && (
                                <div className='text-xs text-yellow-600 mt-1'>Won Game 3</div>
                              )}
                            </div>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type='button'
                            onClick={() => setGame3Winner('team1')}
                            disabled={isSubmitting}
                            className={`p-3 rounded-lg border-2 transition-all text-sm ${
                              game3Winner === 'team1'
                                ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                                : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
                            }`}
                          >
                            <div className='text-center'>
                              <div>Team 1</div>
                              <div className='text-xs text-gray-600'>
                                {getPlayerName(team1Player1)} & {getPlayerName(team1Player2)}
                              </div>
                              {game3Winner === 'team1' && (
                                <div className='text-xs text-yellow-600 mt-1'>Won Game 3</div>
                              )}
                            </div>
                          </button>
                          <button
                            type='button'
                            onClick={() => setGame3Winner('team2')}
                            disabled={isSubmitting}
                            className={`p-3 rounded-lg border-2 transition-all text-sm ${
                              game3Winner === 'team2'
                                ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                                : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
                            }`}
                          >
                            <div className='text-center'>
                              <div>Team 2</div>
                              <div className='text-xs text-gray-600'>
                                {getPlayerName(team2Player1)} & {getPlayerName(team2Player2)}
                              </div>
                              {game3Winner === 'team2' && (
                                <div className='text-xs text-yellow-600 mt-1'>Won Game 3</div>
                              )}
                            </div>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {error && (
          <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded'>
            {error}
          </div>
        )}

        {/* Submit Button */}
        {((seriesType === 'bo1' &&
          ((matchType === '1v1' && winnerId) || (matchType === '2v2' && winningTeam))) ||
          (seriesType === 'bo3' && isSeriesComplete())) && (
          <button
            type='submit'
            disabled={isSubmitting}
            className={`w-full py-4 px-6 rounded-lg transition-all flex items-center justify-center space-x-2 ${
              isSubmitting
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className='w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin'></div>
                <span>Recording Match...</span>
              </>
            ) : (
              <>
                <Save className='w-5 h-5' />
                <span>Record {seriesType === 'bo1' ? 'Match' : 'Series'}</span>
              </>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
