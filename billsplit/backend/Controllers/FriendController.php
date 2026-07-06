<?php
// app/Http/Controllers/FriendController.php
namespace App\Http\Controllers;

use App\Models\Friend;
use Illuminate\Http\Request;

class FriendController extends Controller
{
    public function index()
    {
        return Friend::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'       => 'required|string|max:100',
            'phone'      => 'nullable|string|max:20',
            'promptpay'  => 'nullable|string|max:20',
        ]);
        return Friend::create($data);
    }

    public function update(Request $request, $id)
    {
        $friend = Friend::findOrFail($id);
        $data = $request->validate([
            'name'       => 'sometimes|string|max:100',
            'phone'      => 'nullable|string|max:20',
            'promptpay'  => 'nullable|string|max:20',
        ]);
        $friend->update($data);
        return $friend;
    }

    public function destroy($id)
    {
        Friend::findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }
}
