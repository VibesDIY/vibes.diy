<main id="app" className={c.main}>
  <GoalForm viewer={viewer} database={database} />
  <GoalList goals={goals} milestones={milestones} viewer={viewer} database={database} onComplete={onComplete} />
  <Celebration trigger={celebration} />
</main>;
