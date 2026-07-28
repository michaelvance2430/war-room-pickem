<div className="grid grid-cols-2 gap-3 mb-4">
  <button
    ...
  >
    <div className="font-medium">{game.awayTeam}</div>
    <div className="text-xs text-muted mt-0.5">
      {formatSpread(...)}
    </div>
  </button>

  <button
    ...
  >
    <div className="font-medium">{game.homeTeam}</div>
    <div className="text-xs text-muted mt-0.5">
      {formatSpread(...)}
    </div>
  </button>
</div>