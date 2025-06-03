'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import React, { useState, useEffect } from 'react';
import { Album } from '@/components/PhotosGrid';
import { FadeIn } from '@/components/FadeIn';
import Link from 'next/link';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/context/AuthContext';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrashIcon } from '@radix-ui/react-icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import { getCookie } from 'cookies-next';

export interface AlbumSmall {
  album_id: number;
  album_name: string;
  slug: string;
  image_count: number;
  shared: boolean;
  album_photos: Album[];
}
interface AlbumGrid {
  id: number;
  name: string;
  slug: string;
  image_count: number;
  shared: boolean;
  upload: boolean;
  secret: string;
  album_photos: Album[];
}
export type CategoryLinked = {
  id: number;
  category_name: string;
  category_slug: string;
  album: AlbumGrid;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
};

type LinkedCategory = {
  category_name: string;
  album_name: string;
};

interface CMSProps {
  categoriesLinkedData: CategoryLinked[];
  categoriesData: Category[];
  albumsData: AlbumSmall[];
}

function CMS({ categoriesLinkedData, categoriesData, albumsData }: CMSProps) {
  const [categoriesLinked, setCategoriesLinked] = useState<CategoryLinked[]>(categoriesLinkedData);
  const [categories, setCategories] = useState<Category[]>(categoriesData);
  const [newCategory, setNewCategory] = useState<string>('');
  const [albums, setAlbums] = useState<AlbumSmall[]>(albumsData);
  const [newLinkedCategory, setNewLinkedCategory] = useState<LinkedCategory>({
    category_name: '',
    album_name: '',
  });
  const [albumSelectOpen, setAlbumSelectOpen] = useState(false);

  const fetchCategoriesLinked = async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/category-albums`);
    const data = await response.json();
    setCategoriesLinked(data);
  };

  const fetchCategories = async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
      headers: {
        Authorization: `Bearer ${getCookie('token')}`,
      },
    });
    const data = await response.json();
    setCategories(data);
  };

  const newCategoryHandler = async () => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/categories?name=${newCategory}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getCookie('token')}`,
        },
      },
    );
    setNewCategory('');
    fetchCategories();
  };

  const deleteCategory = async (id: number) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${getCookie('token')}`,
      },
    });
    fetchCategories();
  };

  const { sidebarOpened, user } = useAuth();

  const getAlbums = async () => {
    // console.log('Getting albums');
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/albums/?user_id=${user?.id}`, {
      headers: {
        Authorization: `Bearer ${getCookie('token')}`,
      },
    });
    const data = await response.json();

    // console.log(data);
    setAlbums(data);
  };

  const linkCategory = async () => {
    // get id of the album and category
    // send a post request to the server
    const album_id = albums.find(
      (album) => album.album_name === newLinkedCategory.album_name,
    )?.album_id;

    const category_id = categories.find(
      (category) => category.name === newLinkedCategory.category_name,
    )?.id;
    console.log(album_id, category_id);

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/album-categories?album_id=${album_id}&category_id=${category_id}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getCookie('token')}`,
        },
      },
    );
    fetchCategoriesLinked();
  };

  useEffect(() => {
    fetchCategoriesLinked();
    fetchCategories();
    getAlbums();
  }, []);

  return (
    <div className={`relative flex flex-col ${sidebarOpened ? 'pl-4' : ''} pr-4`}>
      <div className="mt-4 flex w-full items-center justify-between">
        <h1 className="text-2xl font-bold">CMS</h1>
        <ModeToggle />
      </div>
      <div className="mt-4 flex w-full items-center justify-between">
        <h1 className="text-xl font-bold">Categories</h1>
        <Sheet>
          <SheetTrigger asChild>
            <Button>Add Category</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add Category</SheetTitle>
            </SheetHeader>
            <SheetDescription>
              <p className="text-sm text-muted-foreground">
                Add a new category to link to an album
              </p>
            </SheetDescription>
            <div className="mt-4">
              <Label htmlFor="category_name">Category Name</Label>
              <Input
                id="category_name"
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </div>
            <SheetClose className="mt-4">
              <Button onClick={newCategoryHandler}>Add Category</Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </div>
      <FadeIn className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id} className="h-full w-full">
            <CardHeader className="flex flex-row justify-between">
              <CardTitle>{category.name}</CardTitle>
              <Button size="icon" onClick={() => deleteCategory(category.id)}>
                <TrashIcon />
              </Button>
            </CardHeader>
          </Card>
        ))}
      </FadeIn>
      <div className="mt-4 flex w-full items-center justify-between">
        <h1 className="text-xl font-bold">Linked Categories</h1>
        <Sheet>
          <SheetTrigger asChild>
            <Button>Link Category</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Link Category</SheetTitle>
            </SheetHeader>
            <SheetDescription>
              <p className="text-sm text-muted-foreground">Link a category to an album</p>
            </SheetDescription>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Select Category</p>
              <Select
                value={newLinkedCategory.category_name}
                onValueChange={(value) => {
                  setNewLinkedCategory({
                    ...newLinkedCategory,
                    category_name: value,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Link to Album</p>
              <Popover modal open={albumSelectOpen} onOpenChange={setAlbumSelectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={albumSelectOpen}
                    className="w-full justify-between"
                  >
                    {newLinkedCategory.album_name
                      ? albums.find((album) => album.album_name === newLinkedCategory.album_name)
                          ?.album_name
                      : 'Select Album...'}
                    <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0">
                  <Command className="w-full">
                    <CommandInput placeholder="Search albums..." className="h-9" />
                    <CommandEmpty>No album found.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {albums.map((album) => (
                          <CommandItem
                            key={album.album_id}
                            value={album.album_name}
                            onSelect={(currentValue) => {
                              setNewLinkedCategory({
                                ...newLinkedCategory,
                                album_name: currentValue,
                              });
                              setAlbumSelectOpen(false);
                            }}
                          >
                            {album.album_name}
                            <CheckIcon
                              className={cn(
                                'ml-auto h-4 w-4',
                                newLinkedCategory.album_name === album.album_name
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <SheetClose className="mt-4">
              <Button onClick={linkCategory}>Link Category</Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </div>
      <FadeIn className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {categoriesLinked.map((category) => (
          <Card key={category.category_name} className="h-full w-full">
            <CardHeader>
              <CardTitle>{category.category_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Linked to
                <Link
                  className="text-primary underline"
                  href={`/admin/albums/${category.album.slug}`}
                >
                  {' '}
                  {category.album.name}{' '}
                </Link>
                with {category.album.image_count} images
              </p>
            </CardContent>
          </Card>
        ))}
      </FadeIn>
      <div className="mt-4 flex flex-col rounded-lg bg-secondary p-4">
        Link for Getting All Linked Categories:
        <code className="text-xs text-muted-foreground">
          {process.env.NEXT_PUBLIC_API_URL}/category-albums
        </code>
      </div>
    </div>
  );
}

export default CMS;
