import { LoadingSpinner } from '@/components/ui/loading-spinner';
import React from 'react';

function Loading() {
  return (
    <div className="h-screen">
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform`}>
        <LoadingSpinner size={48} />
      </div>
    </div>
  );
}

export default Loading;
