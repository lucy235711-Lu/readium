import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ReaderPage from './pages/ReaderPage';
import ZhiyinPage from './pages/ZhiyinPage';
import UniversePage from './pages/UniversePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/reader/:bookId" element={<ReaderPage />} />
        <Route path="/zhiyin" element={<ZhiyinPage />} />
        <Route path="/universe" element={<UniversePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;