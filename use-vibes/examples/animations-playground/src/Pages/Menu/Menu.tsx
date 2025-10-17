// Menu.tsx
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getContainerStyle,
  getMenuListStyle,
  getTitleStyle,
  getButtonInnerStyle,
  getButtonTextStyle,
} from './Menu.styles';

export const Menu: React.FC = () => {
  const pages = [{ path: '/welcome-to-vibes', name: 'Welcome to Vibes' }];

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes float {
        0%, 100% {
          transform: translateY(0) scale(1);
        }
        50% {
          transform: translateY(-10px) scale(1.05);
        }
      }

      @keyframes fadeInDown {
        from {
          opacity: 0;
          transform: translateY(-50px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .hover-bounce:hover {
        animation: float 3s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div style={getContainerStyle()}>
      <h1 style={getTitleStyle()}>Animations Menu</h1>
      <nav>
        <ul style={getMenuListStyle()}>
          {pages.map((page) => (
            <li key={page.path}>
              <Link to={page.path} style={getButtonInnerStyle()} className="hover-bounce">
                <span style={getButtonTextStyle()}>{page.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};
