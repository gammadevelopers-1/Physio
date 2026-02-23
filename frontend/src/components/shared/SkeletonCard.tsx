const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 bg-[#E5E7EB] rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-[#E5E7EB] rounded w-3/4" />
        <div className="h-3 bg-[#E5E7EB] rounded w-1/2" />
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-3 bg-[#E5E7EB] rounded w-full" />
      <div className="h-3 bg-[#E5E7EB] rounded w-5/6" />
    </div>
    <div className="flex gap-2 mt-3">
      <div className="h-6 bg-[#E5E7EB] rounded w-16" />
      <div className="h-6 bg-[#E5E7EB] rounded w-20" />
    </div>
  </div>
);

export default SkeletonCard;
