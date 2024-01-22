'use client';

import { AlbumGrid } from '@/app/admin/albums/[slug]/page';
import PhotosGrid from '@/components/PhotosGrid';
import { Input } from '@/components/ui/input';
import { ModeToggle } from '@/components/ui/mode-toggle';
import axios from 'axios';
import { useState, useEffect } from 'react';

function Page({ params }: { params: { slug: string } }) {
  const [albumGrid, setAlbumGrid] = useState<AlbumGrid>({
    album_name: '',
    image_count: 0,
    shared: false,
    album_photos: [],
  });
  const [shared, setShared] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);
    axios.get(`http://localhost:8000/album/${params.slug}`).then((response) => {
      setAlbumGrid(response.data);
      setShared(response.data.shared);
    });
    setIsLoading(false);
  }, [params.slug]);

  if (shared && !isLoading) {
    return (
      <div className={`p-4 `}>
        <div className="mt-4 flex  flex-col justify-between space-y-2 md:flex-row md:space-x-2 md:space-y-0">
          <h1 className="text-3xl font-bold ">{albumGrid.album_name}</h1>
          <div className="flex w-full items-center justify-between space-x-2 md:w-10/12 md:justify-end ">
            <Input
              type="text"
              value={`http://localhost:3000/share/${albumGrid.album_name}`}
              readOnly
              className="w-[calc(100%-3rem)] md:w-1/2 lg:w-1/3"
            />
            <ModeToggle />
          </div>
        </div>
        <PhotosGrid albums={albumGrid.album_photos} />
      </div>
    );
  } else if (!shared && !isLoading) {
    return (
      <div>
        <h1>Album is not shared</h1>
      </div>
    );
  } else if (isLoading) {
    return <div></div>;
  }
}

export default Page;
