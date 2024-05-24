import { Button } from '@/components/ui/button';
import {
  DialogTrigger,
  DialogTitle,
  DialogHeader,
  DialogContent,
  Dialog,
} from '@/components/ui/dialog';

export function Dropzone() {
  return (
    <>
      <div className="flex h-48 w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900">
        <div className="text-center">
          <CloudUploadIcon className="mx-auto h-8 w-8 text-gray-500 dark:text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            Drag and drop files here
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            or
            <span className="font-medium text-gray-900 dark:text-gray-50">browse</span>
          </p>
        </div>
      </div>
      <Dialog defaultOpen>
        <DialogTrigger asChild>
          <Button variant="outline">View Uploads</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Uploaded Files</DialogTitle>
            <div>
              <Button
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
                size="icon"
                variant="ghost"
              >
                <XIcon className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            <div className="px-4 py-5 sm:px-6">
              <ul className="divide-y divide-gray-200 dark:divide-gray-800" role="list">
                <li className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileIcon className="mr-2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                        example.jpg
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">2.4 MB</p>
                  </div>
                </li>
                <li className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileIcon className="mr-2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                        document.pdf
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">5.1 MB</p>
                  </div>
                </li>
                <li className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileIcon className="mr-2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                        presentation.pptx
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">8.2 MB</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CloudUploadIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </svg>
  );
}

function FileIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function XIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
