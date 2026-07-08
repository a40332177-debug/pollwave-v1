import React from 'react';
import { Student } from '../types.js';
import { Award, Zap, CheckCircle } from 'lucide-react';

interface LeaderboardViewProps {
  students: { [name: string]: Student };
}

export default function LeaderboardView({ students }: LeaderboardViewProps) {
  // Convert students dictionary to sorted array
  const sortedStudents = Object.values(students).sort((a, b) => {
    // Primary: Score
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Secondary: Correct answer count
    if (b.correctAnswersCount !== a.correctAnswersCount) {
      return b.correctAnswersCount - a.correctAnswersCount;
    }
    // Tertiary: Average response speed (lower is better, but only if they answered)
    const avgSpeedA = a.totalAnsweredCount > 0 ? a.totalResponseTimeMs / a.totalAnsweredCount : 99999;
    const avgSpeedB = b.totalAnsweredCount > 0 ? b.totalResponseTimeMs / b.totalAnsweredCount : 99999;
    return avgSpeedA - avgSpeedB;
  });

  const topThree = sortedStudents.slice(0, 3);
  const runnersUp = sortedStudents.slice(3);

  // Podiums placement order: 2nd (left), 1st (center), 3rd (right)
  const podiumStudents = [
    { rank: 2, item: topThree[1], medal: '🥈', color: 'border-slate-300 bg-slate-900/60 shadow-slate-500/20' },
    { rank: 1, item: topThree[0], medal: '🥇', color: 'border-yellow-400 bg-yellow-950/20 shadow-yellow-500/20 md:scale-105' },
    { rank: 3, item: topThree[2], medal: '🥉', color: 'border-amber-600 bg-amber-950/10 shadow-amber-600/20' }
  ];

  return (
    <div id="leaderboard-section" className="w-full flex flex-col items-center">
      <div className="flex items-center gap-2 mb-6">
        <Award className="w-6 h-6 text-purple-400" />
        <h3 className="text-xl font-semibold text-white tracking-wide">Live Standings</h3>
      </div>

      {sortedStudents.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">No students have scored yet. Waiting for polls to begin!</p>
        </div>
      ) : (
        <div className="w-full max-w-2xl flex flex-col gap-8">
          {/* Top 3 Podium */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 items-end mt-4">
            {podiumStudents.map(({ rank, item, medal, color }) => {
              if (!item) return <div key={rank} className="opacity-0" />;

              const avgTimeS = item.totalAnsweredCount > 0 
                ? ((item.totalResponseTimeMs / item.totalAnsweredCount) / 1000).toFixed(2)
                : '0.00';

              return (
                <div
                  key={rank}
                  className={`flex flex-col items-center p-3 md:p-5 rounded-2xl border ${color} shadow-lg backdrop-blur-md relative transition-transform duration-300`}
                >
                  {/* Rank Badge */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white">
                    {rank}
                  </div>

                  <span className="text-2xl md:text-3xl mt-2 mb-1">{medal}</span>
                  <span className="font-bold text-white text-sm md:text-base text-center truncate max-w-full">
                    {item.name}
                  </span>
                  
                  {/* Score */}
                  <span className="text-purple-400 font-extrabold text-base md:text-xl mt-1">
                    {item.score} pts
                  </span>

                  {/* Micro stats */}
                  <div className="flex flex-col items-center gap-0.5 mt-2 text-[10px] md:text-xs text-slate-400">
                    <span className="flex items-center gap-0.5">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      {item.correctAnswersCount}/{item.totalAnsweredCount}
                    </span>
                    <span className="flex items-center gap-0.5 text-blue-400">
                      <Zap className="w-3 h-3" />
                      {avgTimeS}s
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Runners-up List */}
          {runnersUp.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
              <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400 grid grid-cols-12">
                <span className="col-span-2 text-center">Rank</span>
                <span className="col-span-4">Student</span>
                <span className="col-span-3 text-right">Accuracy</span>
                <span className="col-span-3 text-right">Score</span>
              </div>

              <div className="divide-y divide-slate-800 max-h-60 overflow-y-auto">
                {runnersUp.map((student, index) => {
                  const rank = index + 4;
                  return (
                    <div key={student.name} className="px-4 py-3 text-sm grid grid-cols-12 items-center hover:bg-slate-800/20 transition-colors">
                      <span className="col-span-2 text-center font-mono text-slate-400 font-semibold">
                        #{rank}
                      </span>
                      <span className="col-span-4 font-medium text-white truncate">
                        {student.name}
                      </span>
                      <span className="col-span-3 text-right font-mono text-slate-400 text-xs">
                        {student.correctAnswersCount}/{student.totalAnsweredCount} Correct
                      </span>
                      <span className="col-span-3 text-right font-bold text-purple-400 font-mono">
                        {student.score} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
