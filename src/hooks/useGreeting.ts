export function useGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour >= 6 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 18) return "Good Afternoon";
  if (hour >= 18 && hour < 22) return "Good Evening";
  return "Good Night";
}
