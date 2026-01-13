export default function Footer() {
  return (
    <footer className="bg-dark-800 border-t border-dark-600 mt-8">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-gray-400">
          <div className="flex flex-col gap-1">
            <p className="text-white font-medium">Як купити:</p>
            <p>
              1. Натисни <span className="text-neon-cyan">Купити</span> на будь-якому кресленні
            </p>
            <p>2. Скопіюй повідомлення</p>
            <p>
              3. Напиши мені в Discord: <span className="text-white font-medium">churchuk</span>
            </p>
          </div>
          <div className="text-xs text-gray-500">
            <p>/admin тільки для власника</p>
            <p className="mt-1">© {new Date().getFullYear()} churchukbptrade</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
