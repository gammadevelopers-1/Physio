const SkeletonTableRow = ({ cols = 5 }: { cols?: number }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-[#E5E7EB] rounded" style={{ width: `${60 + (i * 13) % 30}%` }} />
      </td>
    ))}
  </tr>
);

export default SkeletonTableRow;
