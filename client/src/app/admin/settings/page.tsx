'use client';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import React, { useState } from 'react';

function Page() {
  const [verifyData, setVerifyData] = useState(null);
  const verifyToken = async () => {
    const storedToken = getCookie('token');
    const storedUser = getCookie('user');

    if (storedToken && storedUser) {
      axios.get(
        'https://photoaura-api.reactiveshots.com/verify-token?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJnZWV0aCIsImV4cCI6MTcwNjA0MzU1N30.ph0UpJf7PqTIYdoofp1PtI-DNDoRNo_3ngWi5rTFGhs',
        {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        },
      );
    }
  };
  return <Button onClick={verifyToken}>Verify Token</Button>;
}

export default Page;
