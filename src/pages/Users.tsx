import React, { useState, useEffect } from "react";
import { Users as UsersIcon, Plus, Edit2 } from "lucide-react";

type User = {
  id: number;
  name: string;
  email: string;
  profile: string;
  nickname: string | null;
  active: boolean;
};

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    email: "",
    password: "",
    profile: "Atendente",
    active: true
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        await fetch(`/api/users/${editingUserId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
      } else {
        await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
      }
      setShowAddForm(false);
      setEditingUserId(null);
      setFormData({ name: "", nickname: "", email: "", password: "", profile: "Atendente", active: true });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (user: User) => {
    setFormData({
      name: user.name,
      nickname: user.nickname || "",
      email: user.email,
      password: "", // Do not fill password on edit
      profile: user.profile,
      active: user.active
    });
    setEditingUserId(user.id);
    setShowAddForm(true);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#efeae2] font-sans">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
          <p className="mt-2 text-sm text-slate-600">
            Gerencie os usuários e outras configurações do sistema.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowAddForm(true)}
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-transparent bg-green-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Usuário
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Novo Usuário</h2>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nome</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Apelido (opcional)</label>
                <input type="text" value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">E-mail</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Senha</label>
                <input required={!editingUserId} type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border" placeholder={editingUserId ? "Deixe em branco para não alterar" : ""} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Perfil</label>
                <select value={formData.profile} onChange={e => setFormData({...formData, profile: e.target.value})} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border">
                  <option>Atendente</option>
                  <option>Supervisor</option>
                  <option>Administrador</option>
                </select>
              </div>
              {editingUserId && (
                <div className="flex items-center mt-6">
                  <input id="active-checkbox" type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded" />
                  <label htmlFor="active-checkbox" className="ml-2 block text-sm text-slate-900">
                    Usuário Ativo
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-4">
              <button type="button" onClick={() => { setShowAddForm(false); setEditingUserId(null); }} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none">Cancelar</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none">Salvar</button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow-sm ring-1 ring-slate-200 md:rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">
                      Nome
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Apelido
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      E-mail
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Perfil
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Status
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Editar</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {users.map((person) => (
                    <tr key={person.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                        {person.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                        {person.nickname || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                        {person.email}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                        {person.profile}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          person.active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {person.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button onClick={() => handleEdit(person)} className="text-green-600 hover:text-green-900" title="Editar Usuário">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
