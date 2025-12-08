import { useMemo } from 'react';
import { MapContainer, TileLayer, Tooltip, Marker } from 'react-leaflet';
import { divIcon } from 'leaflet';
import type { RestaurantProfile, Order } from '../../types';
import './route-map.css';

interface RouteMapProps {
  restaurant: RestaurantProfile;
  orders: Order[];
}

type LatLngTuple = [number, number];

export default function RouteMap({ restaurant, orders }: RouteMapProps) {
  const restaurantPosition: LatLngTuple = [restaurant.lat, restaurant.lng];
  const orderPositions = useMemo(
    () =>
      orders
        .filter((order) => order.lat !== undefined && order.lng !== undefined)
        .map((order) => ({
          position: [order.lat, order.lng] as LatLngTuple,
          label: order.address,
          id: order.id,
        })),
    [orders],
  );

  const restaurantIcon = useMemo(
    () =>
      divIcon({
        className: 'route-map__pin route-map__pin--restaurant',
        html: '<span>🏬</span>',
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -28],
      }),
    [],
  );

  const orderMarkerData = useMemo(
    () =>
      orderPositions.map((order, index) => ({
        ...order,
        icon: divIcon({
          className: 'route-map__pin',
          html: `<span>${index + 1}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -28],
        }),
      })),
    [orderPositions],
  );

  const bounds = useMemo(() => {
    const points = [restaurantPosition, ...orderPositions.map((item) => item.position)];
    if (points.length === 0) return null;
    const minLat = Math.min(...points.map((point) => point[0]));
    const maxLat = Math.max(...points.map((point) => point[0]));
    const minLng = Math.min(...points.map((point) => point[1]));
    const maxLng = Math.max(...points.map((point) => point[1]));
    if (minLat === maxLat && minLng === maxLng) {
      return null;
    }
    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ] as [LatLngTuple, LatLngTuple];
  }, [restaurantPosition, orderPositions]);

  return (
    <div className="route-map">
      <MapContainer
        center={restaurantPosition}
        zoom={13}
        bounds={bounds ?? undefined}
        className="route-map__canvas"
        scrollWheelZoom={false}
        key={orders.map((order) => order.id).join(',')}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <Marker position={restaurantPosition} icon={restaurantIcon}>
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            Restaurante: {restaurant.name}
          </Tooltip>
        </Marker>
        {orderMarkerData.map((order) => (
          <Marker key={order.id} position={order.position} icon={order.icon}>
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              {order.label}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
